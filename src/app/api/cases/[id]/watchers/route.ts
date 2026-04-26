import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data: watchers, error } = await sb
    .from("case_watchers")
    .select("userId, createdAt")
    .eq("caseId", id);

  if (error) return NextResponse.json(fail(error.message), { status: 500 });

  type WatcherRow = { userId: string; createdAt: string };
  const watcherList = ((watchers as WatcherRow[] | null) ?? []);

  const userIds = watcherList.map((w) => w.userId);
  type UserRow = { id: string; name: string | null; email: string; image: string | null };
  let users: UserRow[] = [];
  if (userIds.length > 0) {
    const { data: userData } = await sb
      .from("users")
      .select("id, name, email, image")
      .in("id", userIds);
    users = (userData ?? []) as UserRow[];
  }

  const result = watcherList.map((w) => ({
    ...w,
    user: users.find((u) => u.id === w.userId) ?? null,
  }));

  return NextResponse.json(ok(result, { total: result.length }));
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data: caseRecord, error: findErr } = await sb
    .from("cases")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (findErr) return NextResponse.json(fail(findErr.message), { status: 500 });
  if (!caseRecord) return NextResponse.json(fail("Case not found"), { status: 404 });

  const { error } = await sb
    .from("case_watchers")
    .upsert(
      { caseId: id, userId: session.user.id },
      { onConflict: "caseId,userId" },
    );

  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  return NextResponse.json(ok({ watching: true }));
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("case_watchers")
    .delete()
    .eq("caseId", id)
    .eq("userId", session.user.id);

  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  return NextResponse.json(ok({ watching: false }));
}
