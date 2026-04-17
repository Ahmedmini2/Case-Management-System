import crypto from "node:crypto";
import { ActivityType, CaseSource, EmailDir, EmailStatus, Priority } from "@prisma/client";
import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { generateCaseNumber } from "@/lib/case-number";
import { db } from "@/lib/prisma";

function verifySignature(rawBody: string, signature: string | null) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return signature === expected;
}

type InboundPayload = {
  subject?: string;
  text?: string;
  html?: string;
  from?: string;
  to?: string[];
  headers?: Record<string, string>;
  messageId?: string;
  inReplyTo?: string;
  references?: string[];
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-secret");
  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json(fail("Invalid webhook signature"), { status: 401 });
  }

  const body = JSON.parse(rawBody) as InboundPayload;
  const inReplyTo = body.inReplyTo ?? body.headers?.["in-reply-to"];

  let caseId: string | null = null;
  if (inReplyTo) {
    const matched = await db.email.findUnique({
      where: { messageId: inReplyTo },
      select: { caseId: true },
    });
    caseId = matched?.caseId ?? null;
  }

  if (!caseId) {
    const fallbackUser = await db.user.findFirst({
      select: { id: true },
    });
    if (!fallbackUser) {
      return NextResponse.json(fail("No user available to own inbound case"), { status: 400 });
    }

    const created = await db.case.create({
      data: {
        caseNumber: await generateCaseNumber(),
        title: body.subject || "Inbound email case",
        description: body.text || body.html || "",
        source: CaseSource.EMAIL,
        status: "OPEN",
        priority: Priority.MEDIUM,
        createdById: fallbackUser.id,
      },
      select: { id: true },
    });
    caseId = created.id;
  }

  const email = await db.$transaction(async (tx) => {
    const createdEmail = await tx.email.create({
      data: {
        caseId,
        messageId: body.messageId,
        threadId: body.references?.[0] ?? body.inReplyTo ?? null,
        subject: body.subject ?? "Inbound message",
        body: body.html ?? body.text ?? "",
        bodyText: body.text ?? null,
        direction: EmailDir.INBOUND,
        from: body.from ?? "unknown@example.com",
        to: body.to ?? [],
        cc: [],
        bcc: [],
        headers: body.headers ?? {},
        status: EmailStatus.DELIVERED,
      },
      select: { id: true, caseId: true, subject: true },
    });

    await tx.activity.create({
      data: {
        caseId,
        type: ActivityType.EMAIL_RECEIVED,
        description: `Inbound email received: ${createdEmail.subject}`,
      },
    });

    return createdEmail;
  });

  return NextResponse.json(ok({ success: true, emailId: email.id, caseId: email.caseId }));
}
