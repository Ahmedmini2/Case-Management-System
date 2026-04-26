import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: pipeline, error: pErr } = await sb
    .from("pipelines")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (pErr) return NextResponse.json(fail(pErr.message), { status: 500 });
  if (!pipeline) return NextResponse.json(fail("Pipeline not found"), { status: 404 });

  const { data: stages, error: sErr } = await sb
    .from("pipeline_stages")
    .select("id, name, color, position, isTerminal")
    .eq("pipelineId", id)
    .order("position", { ascending: true });

  if (sErr) return NextResponse.json(fail(sErr.message), { status: 500 });

  const stageList = stages ?? [];
  const stageIds = stageList.map((s) => s.id);

  type CaseRow = {
    id: string;
    caseNumber: string;
    title: string;
    priority: string;
    dueDate: string | null;
    pipelineStageId: string | null;
    assignedToId: string | null;
    updatedAt: string;
  };
  type UserRow = { id: string; name: string | null; image: string | null };

  let cases: CaseRow[] = [];
  if (stageIds.length > 0) {
    const { data: caseRows, error: cErr } = await sb
      .from("cases")
      .select("id, caseNumber, title, priority, dueDate, pipelineStageId, assignedToId, updatedAt")
      .in("pipelineStageId", stageIds)
      .order("updatedAt", { ascending: false });
    if (cErr) return NextResponse.json(fail(cErr.message), { status: 500 });
    cases = (caseRows ?? []) as CaseRow[];
  }

  const userIds = [...new Set(cases.map((c) => c.assignedToId).filter(Boolean))] as string[];
  const userMap = new Map<string, UserRow>();
  if (userIds.length > 0) {
    const { data: users } = await sb
      .from("users")
      .select("id, name, image")
      .in("id", userIds);
    for (const u of (users ?? []) as UserRow[]) userMap.set(u.id, u);
  }

  const enrichedStages = stageList.map((s) => ({
    id: s.id,
    name: s.name,
    color: s.color,
    position: s.position,
    isTerminal: s.isTerminal,
    cases: cases
      .filter((c) => c.pipelineStageId === s.id)
      .map((c) => ({
        id: c.id,
        caseNumber: c.caseNumber,
        title: c.title,
        priority: c.priority,
        dueDate: c.dueDate,
        assignedTo: c.assignedToId ? userMap.get(c.assignedToId) ?? null : null,
      })),
  }));

  return NextResponse.json(
    ok({
      id: pipeline.id,
      name: pipeline.name,
      stages: enrichedStages,
    }),
  );
}
