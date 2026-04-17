import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const tags = await db.tag.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      color: true,
      _count: { select: { cases: true } },
    },
  });
  return NextResponse.json(ok(tags, { total: tags.length }));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json(fail("Invalid request body"), { status: 400 });

  const existing = await db.tag.findUnique({ where: { name: parsed.data.name } });
  if (existing) return NextResponse.json(fail("Tag already exists"), { status: 409 });

  const tag = await db.tag.create({
    data: parsed.data,
    select: { id: true, name: true, color: true },
  });
  return NextResponse.json(ok(tag), { status: 201 });
}
