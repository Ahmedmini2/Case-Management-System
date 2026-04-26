import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("notifications")
    .update({ isRead: true })
    .eq("id", id)
    .eq("userId", session.user.id)
    .select("id");

  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  if (!data || data.length === 0) return NextResponse.json(fail("Notification not found"), { status: 404 });
  return NextResponse.json(ok({ id, isRead: true }));
}
