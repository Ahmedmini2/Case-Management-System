import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { generateCaseNumber } from "@/lib/case-number";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

  const sb = supabaseAdmin();

  let caseId: string | null = null;
  if (inReplyTo) {
    const { data: matched } = await sb
      .from("emails")
      .select("caseId")
      .eq("messageId", inReplyTo)
      .maybeSingle();
    caseId = matched ? (matched as { caseId: string | null }).caseId : null;
  }

  if (!caseId) {
    const { data: fallbackUser } = await sb
      .from("users")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!fallbackUser) {
      return NextResponse.json(fail("No user available to own inbound case"), { status: 400 });
    }

    const { data: created, error: createErr } = await sb
      .from("cases")
      .insert({
        caseNumber: await generateCaseNumber(),
        title: body.subject || "Inbound email case",
        description: body.text || body.html || "",
        source: "EMAIL",
        status: "OPEN",
        priority: "MEDIUM",
        createdById: (fallbackUser as { id: string }).id,
      })
      .select("id")
      .single();
    if (createErr || !created) {
      return NextResponse.json(fail(createErr?.message ?? "Failed to create case"), { status: 500 });
    }
    caseId = (created as { id: string }).id;
  }

  const { data: createdEmail, error: emailErr } = await sb
    .from("emails")
    .insert({
      caseId,
      messageId: body.messageId,
      threadId: body.references?.[0] ?? body.inReplyTo ?? null,
      subject: body.subject ?? "Inbound message",
      body: body.html ?? body.text ?? "",
      bodyText: body.text ?? null,
      direction: "INBOUND",
      from: body.from ?? "unknown@example.com",
      to: body.to ?? [],
      cc: [],
      bcc: [],
      headers: body.headers ?? {},
      status: "DELIVERED",
    })
    .select("id, caseId, subject")
    .single();

  if (emailErr || !createdEmail) {
    return NextResponse.json(fail(emailErr?.message ?? "Failed to create email"), { status: 500 });
  }

  const email = createdEmail as { id: string; caseId: string | null; subject: string };

  const { error: actErr } = await sb.from("activities").insert({
    caseId,
    type: "EMAIL_RECEIVED",
    description: `Inbound email received: ${email.subject}`,
  });
  if (actErr) console.error("[webhooks/email] best-effort activity failed:", actErr.message);

  return NextResponse.json(ok({ success: true, emailId: email.id, caseId: email.caseId }));
}
