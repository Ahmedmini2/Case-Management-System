import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get("take") ?? "20"), 100);
  const cursor = searchParams.get("cursor");
  const action = searchParams.get("action");
  const userId = searchParams.get("userId");

  const sb = supabaseAdmin();

  // For cursor pagination, fetch the cursor row's createdAt
  let cursorCreatedAt: string | null = null;
  if (cursor) {
    const { data: cursorRow } = await sb
      .from("audit_logs")
      .select("createdAt")
      .eq("id", cursor)
      .maybeSingle();
    cursorCreatedAt = (cursorRow as { createdAt: string } | null)?.createdAt ?? null;
  }

  const buildQuery = () => {
    let q = sb.from("audit_logs").select("*", { count: "exact" });
    if (action) q = q.eq("action", action);
    if (userId) q = q.eq("userId", userId);
    return q;
  };

  let query = buildQuery()
    .order("createdAt", { ascending: false })
    .limit(take + 1);

  if (cursorCreatedAt) {
    query = query.lt("createdAt", cursorCreatedAt);
  }

  const { data: rows, error, count } = await query;
  if (error) return NextResponse.json(fail(error.message), { status: 500 });

  type LogRow = {
    id: string;
    userId: string | null;
    caseId: string | null;
    action: string;
    resource: string;
    resourceId: string | null;
    before: unknown;
    after: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
  };
  const logRows = ((rows as LogRow[] | null) ?? []);

  // Hydrate users
  const userIds = [...new Set(logRows.map((r) => r.userId).filter(Boolean))] as string[];
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

  const enriched = logRows.map((r) => ({
    id: r.id,
    action: r.action,
    resource: r.resource,
    resourceId: r.resourceId,
    before: r.before,
    after: r.after,
    ipAddress: r.ipAddress,
    userAgent: r.userAgent,
    createdAt: r.createdAt,
    user: r.userId ? userMap.get(r.userId) ?? null : null,
  }));

  const hasMore = enriched.length > take;
  const data = hasMore ? enriched.slice(0, take) : enriched;
  const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

  return NextResponse.json(ok(data, { total: count ?? data.length, take, hasMore, nextCursor }));
}
