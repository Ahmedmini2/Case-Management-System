import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { enqueueEmailJob } from "@/lib/queue/jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";

const sendEmailSchema = z.object({
  to: z.array(z.string().email()).min(1),
  subject: z.string().min(1).max(255),
  body: z.string().min(1),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("emails")
    .select("id, subject, body, direction, from, to, status, createdAt, sentAt")
    .eq("caseId", id)
    .order("createdAt", { ascending: false });

  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  const emails = data ?? [];
  return NextResponse.json(ok(emails, { total: emails.length }));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const json = await request.json();
  const parsed = sendEmailSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(fail("Invalid request body"), { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: caseRow, error: caseErr } = await sb
    .from("cases")
    .select("id, caseNumber, title, status, priority, assignedToId")
    .eq("id", id)
    .maybeSingle();
  if (caseErr) return NextResponse.json(fail(caseErr.message), { status: 500 });
  if (!caseRow) return NextResponse.json(fail("Case not found"), { status: 404 });

  const caseItem = caseRow as {
    id: string;
    caseNumber: string;
    title: string;
    status: string;
    priority: string;
    assignedToId: string | null;
  };

  let assigneeName: string | null = null;
  if (caseItem.assignedToId) {
    const { data: assignee } = await sb
      .from("users")
      .select("name")
      .eq("id", caseItem.assignedToId)
      .maybeSingle();
    if (assignee) assigneeName = (assignee as { name: string | null }).name;
  }

  const { data: createdEmail, error: emailErr } = await sb
    .from("emails")
    .insert({
      caseId: id,
      subject: parsed.data.subject,
      body: parsed.data.body,
      bodyText: parsed.data.body,
      direction: "OUTBOUND",
      from: process.env.EMAIL_FROM ?? "support@example.com",
      to: parsed.data.to,
      cc: [],
      bcc: [],
      status: "PENDING",
    })
    .select("id, subject, to, createdAt")
    .single();

  if (emailErr || !createdEmail) {
    return NextResponse.json(fail(emailErr?.message ?? "Failed to create email"), { status: 500 });
  }

  const email = createdEmail as { id: string; subject: string; to: string[]; createdAt: string };

  // Best-effort activity
  const { error: actErr } = await sb.from("activities").insert({
    caseId: id,
    userId: session.user.id,
    type: "EMAIL_SENT",
    description: `Email queued: ${parsed.data.subject}`,
  });
  if (actErr) console.error("[email:create] best-effort activity failed:", actErr.message);

  await enqueueEmailJob({
    emailId: email.id,
    to: parsed.data.to,
    subject: parsed.data.subject,
    caseNumber: caseItem.caseNumber,
    caseTitle: caseItem.title,
    status: caseItem.status,
    priority: caseItem.priority,
    assignee: assigneeName ?? undefined,
    updateMessage: parsed.data.body,
    caseUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/cases/${id}`,
  });

  return NextResponse.json(ok(email), { status: 201 });
}
