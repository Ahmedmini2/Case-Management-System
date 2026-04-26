import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const createSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("tags")
    .select("id, name, color, case_tags(count)")
    .order("name");

  if (error) return NextResponse.json(fail(error.message), { status: 500 });

  type Row = {
    id: string;
    name: string;
    color: string;
    case_tags?: Array<{ count: number }>;
  };
  const tags = ((data as Row[] | null) ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    _count: { cases: t.case_tags?.[0]?.count ?? 0 },
  }));

  return NextResponse.json(ok(tags, { total: tags.length }));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json(fail("Invalid request body"), { status: 400 });

  const sb = supabaseAdmin();
  const { data: existing } = await sb
    .from("tags")
    .select("id")
    .eq("name", parsed.data.name)
    .maybeSingle();
  if (existing) return NextResponse.json(fail("Tag already exists"), { status: 409 });

  const { data, error } = await sb
    .from("tags")
    .insert(parsed.data)
    .select("id, name, color")
    .single();

  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  return NextResponse.json(ok(data), { status: 201 });
}
