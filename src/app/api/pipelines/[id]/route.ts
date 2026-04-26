import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { supabaseAdmin } from "@/lib/supabase/admin";

const updatePipelineSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isDefault: z.boolean().optional(),
  stages: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(100),
        color: z.string().default("#6366f1"),
        isTerminal: z.boolean().optional(),
      }),
    )
    .optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: pipelineRow, error: pErr } = await sb
    .from("pipelines")
    .select("id, name, description, isDefault")
    .eq("id", id)
    .maybeSingle();
  if (pErr) return NextResponse.json(fail(pErr.message), { status: 500 });
  if (!pipelineRow) return NextResponse.json(fail("Pipeline not found"), { status: 404 });

  const { data: stagesRaw } = await sb
    .from("pipeline_stages")
    .select("id, name, color, position, isTerminal")
    .eq("pipelineId", id)
    .order("position", { ascending: true });

  const pipeline = {
    ...(pipelineRow as { id: string; name: string; description: string | null; isDefault: boolean }),
    stages: (stagesRaw ?? []) as {
      id: string;
      name: string;
      color: string;
      position: number;
      isTerminal: boolean;
    }[],
  };

  return NextResponse.json(ok(pipeline));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: existingRow, error: findErr } = await sb
    .from("pipelines")
    .select("id, name, isDefault")
    .eq("id", id)
    .maybeSingle();
  if (findErr) return NextResponse.json(fail(findErr.message), { status: 500 });
  if (!existingRow) return NextResponse.json(fail("Pipeline not found"), { status: 404 });

  const existing = existingRow as { id: string; name: string; isDefault: boolean };

  const body = await request.json();
  const parsed = updatePipelineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("Invalid request body"), { status: 400 });
  }

  // Sequential mutations (no transactional rollback)
  if (parsed.data.isDefault) {
    const { error: clrErr } = await sb
      .from("pipelines")
      .update({ isDefault: false })
      .neq("id", id);
    if (clrErr) console.error("[pipelines:patch] clear default failed:", clrErr.message);
  }

  if (parsed.data.stages) {
    const { error: delErr } = await sb
      .from("pipeline_stages")
      .delete()
      .eq("pipelineId", id);
    if (delErr) {
      return NextResponse.json(fail(delErr.message), { status: 500 });
    }
    if (parsed.data.stages.length > 0) {
      const { error: insErr } = await sb.from("pipeline_stages").insert(
        parsed.data.stages.map((stage, idx) => ({
          pipelineId: id,
          name: stage.name,
          color: stage.color,
          isTerminal: Boolean(stage.isTerminal),
          position: idx,
        })),
      );
      if (insErr) {
        return NextResponse.json(fail(insErr.message), { status: 500 });
      }
    }
  }

  const updatePayload: Record<string, unknown> = {};
  if (parsed.data.name) updatePayload.name = parsed.data.name;
  if (typeof parsed.data.description !== "undefined") updatePayload.description = parsed.data.description;
  if (typeof parsed.data.isDefault !== "undefined") updatePayload.isDefault = parsed.data.isDefault;

  let updated: { id: string; name: string; description: string | null; isDefault: boolean };
  if (Object.keys(updatePayload).length > 0) {
    const { data: updatedRow, error: updErr } = await sb
      .from("pipelines")
      .update(updatePayload)
      .eq("id", id)
      .select("id, name, description, isDefault")
      .single();
    if (updErr || !updatedRow) {
      return NextResponse.json(fail(updErr?.message ?? "Update failed"), { status: 500 });
    }
    updated = updatedRow as {
      id: string;
      name: string;
      description: string | null;
      isDefault: boolean;
    };
  } else {
    const { data: cur } = await sb
      .from("pipelines")
      .select("id, name, description, isDefault")
      .eq("id", id)
      .single();
    updated = cur as {
      id: string;
      name: string;
      description: string | null;
      isDefault: boolean;
    };
  }

  await writeAudit({
    userId: session.user.id,
    action: "PIPELINE_UPDATED",
    resource: "pipeline",
    resourceId: id,
    before: existing,
    after: updated,
    req: request,
  });

  return NextResponse.json(ok(updated));
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: existingRow, error: findErr } = await sb
    .from("pipelines")
    .select("id, isDefault")
    .eq("id", id)
    .maybeSingle();
  if (findErr) return NextResponse.json(fail(findErr.message), { status: 500 });
  if (!existingRow) return NextResponse.json(fail("Pipeline not found"), { status: 404 });

  const existing = existingRow as { id: string; isDefault: boolean };

  const { error: delErr } = await sb.from("pipelines").delete().eq("id", id);
  if (delErr) return NextResponse.json(fail(delErr.message), { status: 500 });

  await writeAudit({
    userId: session.user.id,
    action: "PIPELINE_DELETED",
    resource: "pipeline",
    resourceId: id,
    before: existing,
    req: request,
  });

  return NextResponse.json(ok({ id }));
}
