import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data: existing, error: findErr } = await sb
    .from("api_keys")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (findErr) return NextResponse.json(fail(findErr.message), { status: 500 });
  if (!existing) return NextResponse.json(fail("API key not found"), { status: 404 });

  const { error } = await sb
    .from("api_keys")
    .update({ isActive: false })
    .eq("id", id);

  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  return NextResponse.json(ok({ id, revoked: true }));
}
