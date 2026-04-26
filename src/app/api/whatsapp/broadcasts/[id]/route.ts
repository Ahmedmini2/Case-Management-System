import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Get broadcast details with recipients
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data: broadcast, error: bErr } = await sb
    .from("broadcasts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (bErr) return NextResponse.json(fail(bErr.message), { status: 500 });
  if (!broadcast) return NextResponse.json(fail("Broadcast not found"), { status: 404 });

  const { data: recipients, error: rErr } = await sb
    .from("broadcast_recipients")
    .select("id, phone, contactName, status, error, sentAt, deliveredAt, readAt")
    .eq("broadcastId", id)
    .order("createdAt", { ascending: true });

  if (rErr) return NextResponse.json(fail(rErr.message), { status: 500 });

  return NextResponse.json(ok({ ...(broadcast as Record<string, unknown>), recipients: recipients ?? [] }));
}

// Delete a broadcast (only if DRAFT or COMPLETED)
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data: broadcast, error: findErr } = await sb
    .from("broadcasts")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (findErr) return NextResponse.json(fail(findErr.message), { status: 500 });
  if (!broadcast) return NextResponse.json(fail("Broadcast not found"), { status: 404 });
  const b = broadcast as { status: string };
  if (b.status === "SENDING") {
    return NextResponse.json(fail("Cannot delete a broadcast that is currently sending"), { status: 400 });
  }

  const { error: delErr } = await sb.from("broadcasts").delete().eq("id", id);
  if (delErr) return NextResponse.json(fail(delErr.message), { status: 500 });
  return NextResponse.json(ok({ id }));
}
