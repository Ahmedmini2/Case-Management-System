import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

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

  const rows = await db.notification.findMany({
    where: { userId: session.user.id, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, type: true, title: true, body: true, isRead: true, link: true, createdAt: true },
  });
  return NextResponse.json(ok(rows, { total: rows.length }));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json(fail("Invalid request body"), { status: 400 });

  const created = await db.notification.create({
    data: { ...parsed.data, userId: session.user.id },
    select: { id: true, title: true, isRead: true, createdAt: true },
  });
  return NextResponse.json(ok(created), { status: 201 });
}
