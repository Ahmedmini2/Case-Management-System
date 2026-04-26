import { CustomFieldType } from "@/types/enums";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const createSchema = z.object({
  name: z.string().min(2).max(100),
  label: z.string().min(2).max(120),
  type: z.nativeEnum(CustomFieldType),
  isRequired: z.boolean().optional(),
  options: z.unknown().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("custom_field_defs")
    .select("id, name, label, type, isRequired, position, options")
    .order("position", { ascending: true })
    .order("createdAt", { ascending: true });

  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  return NextResponse.json(ok(data ?? [], { total: (data ?? []).length }));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json(fail("Invalid request body"), { status: 400 });

  const sb = supabaseAdmin();
  const { data: maxRow } = await sb
    .from("custom_field_defs")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = ((maxRow as { position: number } | null)?.position ?? -1) + 1;

  const { data: created, error } = await sb
    .from("custom_field_defs")
    .insert({
      name: parsed.data.name,
      label: parsed.data.label,
      type: parsed.data.type,
      options: parsed.data.options ?? null,
      position: nextPosition,
      isRequired: parsed.data.isRequired ?? false,
    })
    .select("id, name, label, type, isRequired, position")
    .single();

  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  return NextResponse.json(ok(created), { status: 201 });
}
