import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const createSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("contacts")
    .select("id, name, email, phone, company, createdAt, cases(count)")
    .order("createdAt", { ascending: false });

  if (error) return NextResponse.json(fail(error.message), { status: 500 });

  type Row = {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    createdAt: string;
    cases?: Array<{ count: number }>;
  };
  const enriched = (data as Row[] | null ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    company: c.company,
    createdAt: c.createdAt,
    _count: { cases: c.cases?.[0]?.count ?? 0 },
  }));

  return NextResponse.json(ok(enriched, { total: enriched.length }));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json(fail("Invalid request body"), { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("contacts")
    .insert(parsed.data)
    .select("id, name, email, phone, company, createdAt")
    .single();

  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  return NextResponse.json(ok(data), { status: 201 });
}
