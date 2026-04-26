import { after, NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { runAutomationEngine } from "@/lib/automations/engine";
import { auth } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { enqueueEmailJob } from "@/lib/queue/jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";

const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
  isInternal: z.boolean().default(false),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: rawComments, error } = await sb
    .from("comments")
    .select("id, body, isInternal, isResolution, createdAt, authorId")
    .eq("caseId", id)
    .order("createdAt", { ascending: false });

  if (error) return NextResponse.json(fail(error.message), { status: 500 });

  const comments = ((rawComments ?? []) as {
    id: string;
    body: string;
    isInternal: boolean;
    isResolution: boolean;
    createdAt: string;
    authorId: string | null;
  }[]);

  const authorIds = [...new Set(comments.map((c) => c.authorId).filter(Boolean))] as string[];
  const authorMap = new Map<string, { id: string; name: string | null; email: string }>();
  if (authorIds.length > 0) {
    const { data: authors } = await sb
      .from("users")
      .select("id, name, email")
      .in("id", authorIds);
    for (const a of (authors ?? []) as { id: string; name: string | null; email: string }[]) {
      authorMap.set(a.id, a);
    }
  }

  const enriched = comments.map((c) => ({
    id: c.id,
    body: c.body,
    isInternal: c.isInternal,
    isResolution: c.isResolution,
    createdAt: c.createdAt,
    author: c.authorId ? authorMap.get(c.authorId) ?? null : null,
  }));

  return NextResponse.json(ok(enriched, { total: enriched.length }));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: caseExists, error: caseErr } = await sb
    .from("cases")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (caseErr) return NextResponse.json(fail(caseErr.message), { status: 500 });
  if (!caseExists) return NextResponse.json(fail("Case not found"), { status: 404 });

  const json = await request.json();
  const parsed = createCommentSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(fail("Invalid request body"), { status: 400 });
  }

  const { data: created, error: createErr } = await sb
    .from("comments")
    .insert({
      caseId: id,
      authorId: session.user.id,
      body: parsed.data.body,
      isInternal: parsed.data.isInternal,
    })
    .select("id, body, isInternal, createdAt, authorId")
    .single();

  if (createErr || !created) {
    return NextResponse.json(fail(createErr?.message ?? "Failed to create comment"), { status: 500 });
  }

  const cm = created as {
    id: string;
    body: string;
    isInternal: boolean;
    createdAt: string;
    authorId: string | null;
  };

  // Best-effort activity
  const { error: actErr } = await sb.from("activities").insert({
    caseId: id,
    userId: session.user.id,
    type: "COMMENT_ADDED",
    description: parsed.data.isInternal ? "Internal note added" : "Comment added",
  });
  if (actErr) console.error("[comment:create] best-effort activity failed:", actErr.message);

  // Hydrate author for response
  let author: { id: string; name: string | null; email: string } | null = null;
  if (cm.authorId) {
    const { data: a } = await sb
      .from("users")
      .select("id, name, email")
      .eq("id", cm.authorId)
      .maybeSingle();
    if (a) author = a as { id: string; name: string | null; email: string };
  }

  const comment = {
    id: cm.id,
    body: cm.body,
    isInternal: cm.isInternal,
    createdAt: cm.createdAt,
    author,
  };

  const actorUserId = session.user.id;
  const actorEmail = session.user.email ?? null;
  const isInternal = parsed.data.isInternal;
  const body = parsed.data.body;

  after(async () => {
    const sbAfter = supabaseAdmin();
    try {
      await writeAudit({
        userId: actorUserId,
        caseId: id,
        action: "COMMENT_ADDED",
        resource: "comment",
        resourceId: comment.id,
        after: comment,
        req: request,
      });
    } catch (err) {
      console.error("[comment:create] audit failed", err);
    }

    if (!isInternal && actorEmail) {
      try {
        const { data: caseInfo } = await sbAfter
          .from("cases")
          .select("caseNumber, title, status, priority")
          .eq("id", id)
          .maybeSingle();

        if (caseInfo) {
          const ci = caseInfo as { caseNumber: string; title: string; status: string; priority: string };
          const { data: emailRecord } = await sbAfter
            .from("emails")
            .insert({
              caseId: id,
              subject: `New comment on ${ci.caseNumber}`,
              body,
              bodyText: body,
              direction: "OUTBOUND",
              from: process.env.EMAIL_FROM ?? "support@example.com",
              to: [actorEmail],
              cc: [],
              bcc: [],
              status: "PENDING",
            })
            .select("id")
            .single();

          if (emailRecord) {
            await enqueueEmailJob({
              emailId: (emailRecord as { id: string }).id,
              to: [actorEmail],
              subject: `New comment on ${ci.caseNumber}`,
              caseNumber: ci.caseNumber,
              caseTitle: ci.title,
              status: ci.status,
              priority: ci.priority,
              assignee: null,
              updateMessage: body,
              caseUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/cases/${id}`,
            });
          }
        }
      } catch (err) {
        console.error("[comment:create] email job failed", err);
      }
    }

    try {
      await runAutomationEngine({
        triggerType: "COMMENT_ADDED",
        caseId: id,
        actorUserId,
        payload: { isInternal },
      });
    } catch (err) {
      console.error("[comment:create] automation failed", err);
    }
  });

  return NextResponse.json(ok(comment), { status: 201 });
}
