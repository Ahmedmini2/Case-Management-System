import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { supabaseAdmin } from "@/lib/supabase/admin";

const createPipelineSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  stages: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        color: z.string().default("#6366f1"),
      }),
    )
    .min(1)
    .optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: pipelinesRaw, error } = await sb
    .from("pipelines")
    .select("id, name, description, isDefault, createdAt")
    .order("isDefault", { ascending: false })
    .order("createdAt", { ascending: true });

  if (error) return NextResponse.json(fail(error.message), { status: 500 });

  const pipelines = (pipelinesRaw ?? []) as {
    id: string;
    name: string;
    description: string | null;
    isDefault: boolean;
    createdAt: string;
  }[];
  const ids = pipelines.map((p) => p.id);

  // Stages for all pipelines
  const stagesByPipelineId = new Map<
    string,
    { id: string; name: string; color: string; position: number; isTerminal: boolean }[]
  >();
  if (ids.length > 0) {
    const { data: stagesRaw } = await sb
      .from("pipeline_stages")
      .select("id, name, color, position, isTerminal, pipelineId")
      .in("pipelineId", ids)
      .order("position", { ascending: true });
    for (const s of (stagesRaw ?? []) as {
      id: string;
      name: string;
      color: string;
      position: number;
      isTerminal: boolean;
      pipelineId: string;
    }[]) {
      const list = stagesByPipelineId.get(s.pipelineId) ?? [];
      list.push({
        id: s.id,
        name: s.name,
        color: s.color,
        position: s.position,
        isTerminal: s.isTerminal,
      });
      stagesByPipelineId.set(s.pipelineId, list);
    }
  }

  // Case counts per pipeline
  const caseCountByPipeline = new Map<string, number>();
  if (ids.length > 0) {
    const { data: caseRows } = await sb
      .from("cases")
      .select("pipelineId")
      .in("pipelineId", ids);
    for (const r of (caseRows ?? []) as { pipelineId: string | null }[]) {
      if (!r.pipelineId) continue;
      caseCountByPipeline.set(r.pipelineId, (caseCountByPipeline.get(r.pipelineId) ?? 0) + 1);
    }
  }

  const items = pipelines.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isDefault: p.isDefault,
    stages: stagesByPipelineId.get(p.id) ?? [],
    _count: { cases: caseCountByPipeline.get(p.id) ?? 0 },
  }));

  return NextResponse.json(ok(items, { total: items.length }));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const body = await request.json();
  const parsed = createPipelineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("Invalid request body"), { status: 400 });
  }

  const sb = supabaseAdmin();

  if (parsed.data.isDefault) {
    const { error: clrErr } = await sb
      .from("pipelines")
      .update({ isDefault: false })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (clrErr) console.error("[pipelines:create] clear default failed:", clrErr.message);
  }

  const { data: createdRow, error: createErr } = await sb
    .from("pipelines")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      isDefault: Boolean(parsed.data.isDefault),
    })
    .select("id, name, description, isDefault")
    .single();

  if (createErr || !createdRow) {
    return NextResponse.json(fail(createErr?.message ?? "Create failed"), { status: 500 });
  }
  const pipeline = createdRow as {
    id: string;
    name: string;
    description: string | null;
    isDefault: boolean;
  };

  // Default pipeline mirrors the CaseStatus enum so the board view aligns 1:1 with case status.
  const stages = (parsed.data.stages ?? [
    { name: "Open", color: "#3b82f6" },
    { name: "In Progress", color: "#0ea5e9" },
    { name: "Waiting on Customer", color: "#f59e0b" },
    { name: "Waiting on Third Party", color: "#a855f7" },
    { name: "Resolved", color: "#22c55e" },
    { name: "Closed", color: "#6b7280" },
    { name: "Cancelled", color: "#ef4444" },
  ]).map((stage, idx) => ({
    pipelineId: pipeline.id,
    name: stage.name,
    color: stage.color,
    position: idx,
    isTerminal: stage.name === "Closed" || stage.name === "Cancelled",
  }));

  const { error: stagesErr } = await sb.from("pipeline_stages").insert(stages);
  if (stagesErr) {
    console.error("[pipelines:create] stages insert failed:", stagesErr.message);
  }

  await writeAudit({
    userId: session.user.id,
    action: "PIPELINE_CREATED",
    resource: "pipeline",
    resourceId: pipeline.id,
    after: pipeline,
    req: request,
  });

  return NextResponse.json(ok(pipeline), { status: 201 });
}
