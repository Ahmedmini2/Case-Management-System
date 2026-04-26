import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const GRAPH_URL = "https://graph.facebook.com/v19.0";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data: template, error: tErr } = await sb
    .from("whatsapp_templates")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (tErr) return NextResponse.json(fail(tErr.message), { status: 500 });
  if (!template) return NextResponse.json(fail("Template not found"), { status: 404 });

  const t = template as { id: string; name: string | null };

  // Delete from Meta if it has a name
  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (wabaId && token && t.name) {
    try {
      await fetch(`${GRAPH_URL}/${wabaId}/message_templates?name=${t.name}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error("[WhatsApp Templates] Delete from Meta error:", err);
    }
  }

  const { error: delErr } = await sb.from("whatsapp_templates").delete().eq("id", id);
  if (delErr) return NextResponse.json(fail(delErr.message), { status: 500 });
  return NextResponse.json(ok({ id }));
}
