import crypto from "node:crypto";
import { ActivityType, CaseSource, CaseStatus, Priority } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { generateCaseNumber } from "@/lib/case-number";
import { enqueueEmailJob } from "@/lib/queue/jobs";
import { db } from "@/lib/prisma";

const submitSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  subject: z.string().min(3).max(200),
  description: z.string().min(5).max(5000),
  category: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = submitSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json(fail("Invalid request body"), { status: 400 });

  const data = parsed.data;
  const defaultUser = await db.user.findFirst({ select: { id: true } });
  if (!defaultUser) {
    return NextResponse.json(fail("No users exist to own portal cases"), { status: 400 });
  }

  const contact = await db.contact.upsert({
    where: { email: data.email },
    update: { name: data.name },
    create: { email: data.email, name: data.name },
    select: { id: true, email: true, name: true },
  });

  const portalToken = crypto.randomUUID().replace(/-/g, "");

  const created = await db.$transaction(async (tx) => {
    const caseItem = await tx.case.create({
      data: {
        caseNumber: await generateCaseNumber(),
        title: data.subject,
        description: data.description,
        type: data.category,
        source: CaseSource.PORTAL,
        status: CaseStatus.OPEN,
        priority: Priority.MEDIUM,
        createdById: defaultUser.id,
        contactId: contact.id,
        metadata: { portalToken },
      },
      select: { id: true, caseNumber: true, title: true, status: true, priority: true },
    });

    await tx.activity.create({
      data: {
        caseId: caseItem.id,
        userId: defaultUser.id,
        type: ActivityType.CREATED,
        description: "Case created from customer portal",
      },
    });

    return caseItem;
  });

  if (contact.email) {
    const emailRecord = await db.email.create({
      data: {
        caseId: created.id,
        subject: `Portal case received: ${created.caseNumber}`,
        body: "Thanks for your request. Track updates using your portal link.",
        bodyText: "Thanks for your request. Track updates using your portal link.",
        direction: "OUTBOUND",
        from: process.env.EMAIL_FROM ?? "support@example.com",
        to: [contact.email],
        cc: [],
        bcc: [],
        status: "PENDING",
      },
      select: { id: true },
    });

    const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/portal/${portalToken}`;
    await enqueueEmailJob({
      emailId: emailRecord.id,
      to: [contact.email],
      subject: `Portal case received: ${created.caseNumber}`,
      caseNumber: created.caseNumber,
      caseTitle: created.title,
      status: created.status,
      priority: created.priority,
      assignee: null,
      updateMessage: `Track your case here: ${portalUrl}`,
      caseUrl: portalUrl,
    });
  }

  return NextResponse.json(
    ok({
      caseId: created.id,
      caseNumber: created.caseNumber,
      token: portalToken,
      trackingUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/portal/${portalToken}`,
    }),
    { status: 201 },
  );
}
