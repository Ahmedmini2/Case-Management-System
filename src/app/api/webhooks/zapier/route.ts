import crypto from "node:crypto";
import { ActivityType, CaseSource, CaseStatus, Priority } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { verifyApiKey } from "@/lib/api-keys";
import { writeAudit } from "@/lib/audit";
import { generateCaseNumber } from "@/lib/case-number";
import { db } from "@/lib/prisma";

const zapierSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().optional(),
  priority: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  type: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactName: z.string().optional(),
  assigneeEmail: z.string().email().optional(),
  customFields: z.record(z.unknown()).optional(),
  externalId: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  source: z.string().optional(),
});

function verifySecret(rawBody: string, provided: string | null) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;
  if (!provided) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

async function verifyRequest(request: Request, rawBody: string) {
  const webhookSig = request.headers.get("x-webhook-secret");
  if (verifySecret(rawBody, webhookSig)) return true;

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length).trim();
  const key = await verifyApiKey(token);
  return Boolean(key);
}

export async function POST(request: Request) {
  const raw = await request.text();
  const authorized = await verifyRequest(request, raw);
  if (!authorized) return NextResponse.json(fail("Unauthorized webhook"), { status: 401 });

  const parsed = zapierSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) return NextResponse.json(fail("Invalid payload"), { status: 400 });

  const data = parsed.data;

  const [assignee, defaultPipeline] = await Promise.all([
    data.assigneeEmail
      ? db.user.findUnique({
          where: { email: data.assigneeEmail },
          select: { id: true },
        })
      : Promise.resolve(null),
    db.pipeline.findFirst({
      where: { isDefault: true },
      select: {
        id: true,
        stages: { orderBy: { position: "asc" }, take: 1, select: { id: true } },
      },
    }),
  ]);

  const fallbackOwner = await db.user.findFirst({ select: { id: true } });
  if (!fallbackOwner) {
    return NextResponse.json(fail("No users exist to own the created case"), { status: 400 });
  }

  const contact =
    data.contactEmail
      ? await db.contact.upsert({
          where: { email: data.contactEmail },
          update: { name: data.contactName ?? data.contactEmail },
          create: { email: data.contactEmail, name: data.contactName ?? data.contactEmail },
          select: { id: true },
        })
      : null;

  const created = await db.$transaction(async (tx) => {
    const caseItem = await tx.case.create({
      data: {
        caseNumber: await generateCaseNumber(),
        title: data.title,
        description: data.description,
        priority: (data.priority as Priority | undefined) ?? Priority.MEDIUM,
        status: CaseStatus.OPEN,
        source: CaseSource.ZAPIER,
        type: data.type,
        customFields: data.customFields,
        externalId: data.externalId,
        createdById: fallbackOwner.id,
        assignedToId: assignee?.id ?? null,
        contactId: contact?.id ?? null,
        pipelineId: defaultPipeline?.id ?? null,
        pipelineStageId: defaultPipeline?.stages[0]?.id ?? null,
      },
      select: { id: true, caseNumber: true },
    });

    await tx.activity.create({
      data: {
        caseId: caseItem.id,
        userId: fallbackOwner.id,
        type: ActivityType.CREATED,
        description: "Case created via Zapier webhook",
      },
    });

    if (data.tags?.length) {
      for (const tagName of data.tags) {
        const tag = await tx.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName },
          select: { id: true },
        });
        await tx.caseTag.upsert({
          where: { caseId_tagId: { caseId: caseItem.id, tagId: tag.id } },
          update: {},
          create: { caseId: caseItem.id, tagId: tag.id },
        });
      }
    }

    return caseItem;
  });

  await writeAudit({
    userId: fallbackOwner.id,
    caseId: created.id,
    action: "ZAPIER_WEBHOOK_CREATED_CASE",
    resource: "case",
    resourceId: created.id,
    after: created,
    req: request,
  });

  return NextResponse.json(ok({ success: true, caseId: created.id, caseNumber: created.caseNumber }));
}
