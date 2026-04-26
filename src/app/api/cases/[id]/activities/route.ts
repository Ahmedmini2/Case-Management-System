import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const sb = supabaseAdmin();
  const { data: rows, error } = await sb
    .from("activities")
    .select("id, type, description, oldValue, newValue, metadata, createdAt, userId")
    .eq("caseId", id)
    .order("createdAt", { ascending: false });

  if (error) return NextResponse.json(fail(error.message), { status: 500 });

  type ActRow = {
    id: string;
    type: string;
    description: string;
    oldValue: string | null;
    newValue: string | null;
    metadata: unknown;
    createdAt: string;
    userId: string | null;
  };
  const activities = ((rows as ActRow[] | null) ?? []);

  const userIds = [...new Set(activities.map((a) => a.userId).filter(Boolean))] as string[];
  const userMap = new Map<string, { id: string; name: string | null; email: string }>();
  if (userIds.length > 0) {
    const { data: users } = await sb
      .from("users")
      .select("id, name, email")
      .in("id", userIds);
    for (const u of (users ?? []) as { id: string; name: string | null; email: string }[]) {
      userMap.set(u.id, u);
    }
  }

  const enriched = activities.map((a) => ({
    id: a.id,
    type: a.type,
    description: a.description,
    oldValue: a.oldValue,
    newValue: a.newValue,
    metadata: a.metadata,
    createdAt: a.createdAt,
    user: a.userId ? userMap.get(a.userId) ?? null : null,
  }));

  return NextResponse.json(ok(enriched, { total: enriched.length }));
}
