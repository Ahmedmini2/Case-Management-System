import { ActivityType, CaseSource, CaseStatus, Priority } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { runAutomationEngine } from "@/lib/automations/engine";
import { auth } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { generateCaseNumber } from "@/lib/case-number";
import { enqueueEmailJob } from "@/lib/queue/jobs";
import { triggerPusherEvent } from "@/lib/pusher";
import { db } from "@/lib/prisma";
import { calculateSlaDueDate, enqueueSlaWarning } from "@/lib/sla";

const createCaseSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(5000).optional(),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  status: z.nativeEnum(CaseStatus).default(CaseStatus.OPEN),
  type: z.string().max(100).optional(),
  assignedToId: z.string().optional(),
  teamId: z.string().optional(),
  contactId: z.string().optional(),
  pipelineId: z.string().optional(),
  pipelineStageId: z.string().optional(),
  source: z.nativeEnum(CaseSource).default(CaseSource.MANUAL),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get("take") ?? "20"), 50);
  const cursor = searchParams.get("cursor");
  const q = searchParams.get("q");
  const status = searchParams.get("status") as CaseStatus | null;
  const priority = searchParams.get("priority") as Priority | null;

  const where = {
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { caseNumber: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
  };

  const [items, total] = await Promise.all([
    db.case.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        caseNumber: true,
        title: true,
        status: true,
        priority: true,
        source: true,
        createdAt: true,
        dueDate: true,
        assignedTo: {
          select: { id: true, name: true, email: true },
        },
        tags: {
          select: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    }),
    db.case.count({ where }),
  ]);

  const hasMore = items.length > take;
  const data = hasMore ? items.slice(0, take) : items;
  const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

  return NextResponse.json(
    ok(data, {
      total,
      take,
      hasMore,
      nextCursor,
    }),
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  try {
    const json = await request.json();
    const parsed = createCaseSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(fail("Invalid request body"), { status: 400 });
    }

    const defaultPipeline = parsed.data.pipelineId
      ? await db.pipeline.findUnique({
          where: { id: parsed.data.pipelineId },
          select: { id: true },
        })
      : await db.pipeline.findFirst({
          where: { isDefault: true },
          select: {
            id: true,
            stages: { orderBy: { position: "asc" }, take: 1, select: { id: true } },
          },
        });

    const stageId =
      parsed.data.pipelineStageId ?? ("stages" in (defaultPipeline ?? {}) ? defaultPipeline?.stages[0]?.id : null);

    const created = await db.$transaction(async (tx) => {
      const caseNumber = await generateCaseNumber();
      const dueDate = await calculateSlaDueDate(parsed.data.priority);
      const newCase = await tx.case.create({
        data: {
          caseNumber,
          title: parsed.data.title,
          description: parsed.data.description,
          priority: parsed.data.priority,
          status: parsed.data.status,
          type: parsed.data.type,
          assignedToId: parsed.data.assignedToId,
          teamId: parsed.data.teamId,
          contactId: parsed.data.contactId,
          source: parsed.data.source,
          createdById: session.user.id,
          pipelineId: parsed.data.pipelineId ?? defaultPipeline?.id ?? null,
          pipelineStageId: stageId ?? null,
          dueDate,
        },
        select: {
          id: true,
          caseNumber: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
        },
      });

      await tx.activity.create({
        data: {
          caseId: newCase.id,
          userId: session.user.id,
          type: ActivityType.CREATED,
          description: "Case created",
        },
      });

      return newCase;
    });

    await writeAudit({
      userId: session.user.id,
      caseId: created.id,
      action: "CASE_CREATED",
      resource: "case",
      resourceId: created.id,
      after: created,
      req: request,
    });

    await triggerPusherEvent("cases", "case:created", {
      id: created.id,
      caseNumber: created.caseNumber,
      title: created.title,
    });

    // Fire-and-forget: SLA, automations, email — don't block the response
    Promise.all([
      enqueueSlaWarning(created.id).catch((e) => console.error("[POST /api/cases] SLA warning error:", e)),
      runAutomationEngine({
        triggerType: "CASE_CREATED",
        caseId: created.id,
        actorUserId: session.user.id,
      }).catch((e) => console.error("[POST /api/cases] Automation error:", e)),
      (async () => {
        if (!session.user.email) return;
        const emailRecord = await db.email.create({
          data: {
            caseId: created.id,
            subject: `Case created: ${created.caseNumber}`,
            body: "A new case has been created.",
            bodyText: "A new case has been created.",
            direction: "OUTBOUND",
            from: process.env.EMAIL_FROM ?? "support@example.com",
            to: [session.user.email],
            cc: [],
            bcc: [],
            status: "PENDING",
          },
          select: { id: true },
        });
        await enqueueEmailJob({
          emailId: emailRecord.id,
          to: [session.user.email],
          subject: `Case created: ${created.caseNumber}`,
          caseNumber: created.caseNumber,
          caseTitle: created.title,
          status: created.status,
          priority: created.priority,
          assignee: null,
          updateMessage: "Your case has been created successfully.",
          caseUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/cases/${created.id}`,
        });
      })().catch((e) => console.error("[POST /api/cases] Email error:", e)),
    ]).catch(() => {});

    return NextResponse.json(ok(created), { status: 201 });
  } catch (err) {
    console.error("[POST /api/cases] Error:", err);
    return NextResponse.json(fail("Failed to create case"), { status: 500 });
  }
}
