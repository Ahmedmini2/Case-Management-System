import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const sb = supabaseAdmin();

  // Find case by metadata.portalToken (JSON field)
  const { data: caseRow, error: caseErr } = await sb
    .from("cases")
    .select("id, caseNumber, title, description, status, priority, source, createdAt, updatedAt")
    .eq("metadata->>portalToken", token)
    .maybeSingle();

  if (caseErr) return NextResponse.json(fail(caseErr.message), { status: 500 });
  if (!caseRow) return NextResponse.json(fail("Portal case not found"), { status: 404 });

  const c = caseRow as { id: string } & Record<string, unknown>;

  // Fetch comments (non-internal) with author
  const { data: comments, error: cErr } = await sb
    .from("comments")
    .select("id, body, createdAt, authorId")
    .eq("caseId", c.id)
    .eq("isInternal", false)
    .order("createdAt", { ascending: true });

  if (cErr) return NextResponse.json(fail(cErr.message), { status: 500 });

  const commentsList = (comments ?? []) as { id: string; body: string; createdAt: string; authorId: string | null }[];
  const authorIds = [...new Set(commentsList.map((c) => c.authorId).filter(Boolean))] as string[];

  const authorMap = new Map<string, { name: string | null; email: string }>();
  if (authorIds.length > 0) {
    const { data: authors } = await sb
      .from("users")
      .select("id, name, email")
      .in("id", authorIds);
    for (const a of (authors ?? []) as { id: string; name: string | null; email: string }[]) {
      authorMap.set(a.id, { name: a.name, email: a.email });
    }
  }

  const commentsEnriched = commentsList.map((cm) => ({
    id: cm.id,
    body: cm.body,
    createdAt: cm.createdAt,
    author: cm.authorId ? authorMap.get(cm.authorId) ?? null : null,
  }));

  const { data: activities, error: aErr } = await sb
    .from("activities")
    .select("id, description, type, createdAt")
    .eq("caseId", c.id)
    .order("createdAt", { ascending: true });

  if (aErr) return NextResponse.json(fail(aErr.message), { status: 500 });

  return NextResponse.json(
    ok({
      ...c,
      comments: commentsEnriched,
      activities: activities ?? [],
    }),
  );
}
