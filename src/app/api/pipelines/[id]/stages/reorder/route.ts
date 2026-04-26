import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({
  stageIds: z.array(z.string()).min(1),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json(fail("Invalid request body"), { status: 400 });

  const sb = supabaseAdmin();
  const { data: stagesRaw, error: findErr } = await sb
    .from("pipeline_stages")
    .select("id")
    .eq("pipelineId", id);
  if (findErr) return NextResponse.json(fail(findErr.message), { status: 500 });

  const stages = (stagesRaw ?? []) as { id: string }[];
  const existingIds = new Set(stages.map((s) => s.id));
  if (parsed.data.stageIds.some((sid) => !existingIds.has(sid))) {
    return NextResponse.json(fail("Stage list does not match pipeline stages"), { status: 400 });
  }

  const providedIds = parsed.data.stageIds;
  const missingIds = stages.map((s) => s.id).filter((sid) => !providedIds.includes(sid));
  const finalOrder = [...providedIds, ...missingIds];

  // Two-phase reorder avoids unique constraint collisions on [pipelineId, position].
  // Phase 1: move all to high positions
  for (let idx = 0; idx < finalOrder.length; idx += 1) {
    const { error } = await sb
      .from("pipeline_stages")
      .update({ position: idx + 1000 })
      .eq("id", finalOrder[idx]);
    if (error) return NextResponse.json(fail(error.message), { status: 500 });
  }
  // Phase 2: set final positions
  for (let idx = 0; idx < finalOrder.length; idx += 1) {
    const { error } = await sb
      .from("pipeline_stages")
      .update({ position: idx })
      .eq("id", finalOrder[idx]);
    if (error) return NextResponse.json(fail(error.message), { status: 500 });
  }

  return NextResponse.json(ok({ pipelineId: id, reordered: true }));
}
