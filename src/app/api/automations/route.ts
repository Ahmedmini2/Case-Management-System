import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const automationSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  trigger: z.object({
    type: z.string(),
    conditions: z.array(z.object({ field: z.string(), operator: z.string(), value: z.unknown().optional() })).optional(),
  }),
  actions: z.array(z.object({ type: z.string(), config: z.record(z.unknown()).optional() })),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("automations")
    .select("id, name, description, isActive, trigger, actions, runCount, lastRunAt, createdAt")
    .order("createdAt", { ascending: false });

  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  return NextResponse.json(ok(data ?? [], { total: (data ?? []).length }));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const parsed = automationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json(fail("Invalid request body"), { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("automations")
    .insert(parsed.data)
    .select("id, name, isActive, createdAt")
    .single();

  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  return NextResponse.json(ok(data), { status: 201 });
}
