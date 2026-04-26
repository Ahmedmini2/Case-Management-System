import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  trigger: z.unknown().optional(),
  actions: z.unknown().optional(),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("automations")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  if (!data) return NextResponse.json(fail("Automation not found"), { status: 404 });
  return NextResponse.json(ok(data));
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json(fail("Invalid request body"), { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("automations")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  return NextResponse.json(ok(data));
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });
  const sb = supabaseAdmin();
  const { error } = await sb.from("automations").delete().eq("id", id);
  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  return NextResponse.json(ok({ id }));
}
