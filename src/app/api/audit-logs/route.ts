import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const { searchParams } = new URL(request.url);
  const take = Math.min(Number(searchParams.get("take") ?? "20"), 100);
  const cursor = searchParams.get("cursor");
  const action = searchParams.get("action");
  const userId = searchParams.get("userId");

  const where = {
    ...(action ? { action } : {}),
    ...(userId ? { userId } : {}),
  };

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        before: true,
        after: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  const hasMore = rows.length > take;
  const data = hasMore ? rows.slice(0, take) : rows;
  const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;

  return NextResponse.json(ok(data, { total, take, hasMore, nextCursor }));
}
