import crypto from "node:crypto";
import { ActivityType, CaseSource, CaseStatus, Priority } from "@/types/enums";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { generateCaseNumber } from "@/lib/case-number";
import { enqueueEmailJob } from "@/lib/queue/jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
  const sb = supabaseAdmin();

  const { data: defaultUserRow } = await sb
    .from("users")
    .select("id")
    .limit(1)
    .maybeSingle();
  const defaultUser = defaultUserRow as { id: string } | null;
  if (!defaultUser) {
    return NextResponse.json(fail("No users exist to own portal cases"), { status: 400 });
  }

  // Upsert contact by email
  let contactId: string | null = null;
  let contactEmail: string | null = null;
  let contactName: string | null = null;

  const { data: existingContact } = await sb
    .from("contacts")
    .select("id, email, name")
    .eq("email", data.email)
    .maybeSingle();

  if (existingContact) {
    const ec = existingContact as { id: string; email: string; name: string | null };
    contactId = ec.id;
    contactEmail = ec.email;
    contactName = ec.name;
    await sb.from("contacts").update({ name: data.name }).eq("id", ec.id);
    contactName = data.name;
  } else {
    const { data: newContact, error: contactErr } = await sb
      .from("contacts")
      .insert({ email: data.email, name: data.name })
      .select("id, email, name")
      .single();
    if (contactErr || !newContact) {
      return NextResponse.json(fail(contactErr?.message ?? "Failed to create contact"), {
        status: 500,
      });
    }
    const nc = newContact as { id: string; email: string; name: string | null };
    contactId = nc.id;
    contactEmail = nc.email;
    contactName = nc.name;
  }

  const portalToken = crypto.randomUUID().replace(/-/g, "");

  const caseNumber = await generateCaseNumber();
  const { data: createdRow, error: createErr } = await sb
    .from("cases")
    .insert({
      caseNumber,
      title: data.subject,
      description: data.description,
      type: data.category,
      source: CaseSource.PORTAL,
      status: CaseStatus.OPEN,
      priority: Priority.MEDIUM,
      createdById: defaultUser.id,
      contactId,
      metadata: { portalToken },
    })
    .select("id, caseNumber, title, status, priority")
    .single();

  if (createErr || !createdRow) {
    return NextResponse.json(fail(createErr?.message ?? "Failed to create case"), { status: 500 });
  }

  const created = createdRow as {
    id: string;
    caseNumber: string;
    title: string;
    status: string;
    priority: string;
  };

  // Best-effort activity insert
  const { error: actErr } = await sb.from("activities").insert({
    caseId: created.id,
    userId: defaultUser.id,
    type: ActivityType.CREATED,
    description: "Case created from customer portal",
  });
  if (actErr) console.error("[portal:submit] activity failed:", actErr.message);

  if (contactEmail) {
    const { data: emailRow, error: emErr } = await sb
      .from("emails")
      .insert({
        caseId: created.id,
        subject: `Portal case received: ${created.caseNumber}`,
        body: "Thanks for your request. Track updates using your portal link.",
        bodyText: "Thanks for your request. Track updates using your portal link.",
        direction: "OUTBOUND",
        from: process.env.EMAIL_FROM ?? "support@example.com",
        to: [contactEmail],
        cc: [],
        bcc: [],
        status: "PENDING",
      })
      .select("id")
      .single();

    if (!emErr && emailRow) {
      const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/portal/${portalToken}`;
      await enqueueEmailJob({
        emailId: (emailRow as { id: string }).id,
        to: [contactEmail],
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
  }

  // contactName is consumed by mutation above; reference for type completeness
  void contactName;

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
