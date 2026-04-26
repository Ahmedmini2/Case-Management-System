import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const createSchema = z.object({
  caseId: z.string().optional(),
  type: z.string().default("INFO"),
  title: z.string().min(2).max(200),
  body: z.string().optional(),
  link: z.string().optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  const sb = supabaseAdmin();
  let query = sb
    .from("notifications")
    .select("id, type, title, body, isRead, link, createdAt")
    .eq("userId", session.user.id)
    .order("createdAt", { ascending: false })
    .limit(50);

  if (unreadOnly) query = query.eq("isRead", false);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(fail(error.message), { status: 500 });
  }
  return NextResponse.json(ok(data ?? [], { total: (data ?? []).length }));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json(fail("Invalid request body"), { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("notifications")
    .insert({ ...parsed.data, userId: session.user.id })
    .select("id, title, isRead, createdAt")
    .single();

  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  return NextResponse.json(ok(data), { status: 201 });
}
