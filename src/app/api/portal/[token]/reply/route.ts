import { ActivityType } from "@/types/enums";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

const replySchema = z.object({
  body: z.string().min(1).max(5000),
});

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const parsed = replySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json(fail("Invalid request body"), { status: 400 });

  const sb = supabaseAdmin();

  const { data: caseRow } = await sb
    .from("cases")
    .select("id, createdById")
    .filter("metadata->>portalToken", "eq", token)
    .limit(1)
    .maybeSingle();

  const caseItem = caseRow as { id: string; createdById: string | null } | null;
  if (!caseItem) return NextResponse.json(fail("Portal case not found"), { status: 404 });

  const { data: created, error: cErr } = await sb
    .from("comments")
    .insert({
      caseId: caseItem.id,
      authorId: caseItem.createdById,
      body: parsed.data.body,
      isInternal: false,
    })
    .select("id, body, createdAt")
    .single();
  if (cErr || !created) {
    return NextResponse.json(fail(cErr?.message ?? "Failed to create comment"), { status: 500 });
  }

  const { error: actErr } = await sb.from("activities").insert({
    caseId: caseItem.id,
    userId: caseItem.createdById,
    type: ActivityType.COMMENT_ADDED,
    description: "Customer replied from portal",
  });
  if (actErr) console.error("[portal:reply] activity failed:", actErr.message);

  return NextResponse.json(ok(created), { status: 201 });
}
