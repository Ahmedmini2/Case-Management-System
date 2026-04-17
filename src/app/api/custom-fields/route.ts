import { CustomFieldType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

const createSchema = z.object({
  name: z.string().min(2).max(100),
  label: z.string().min(2).max(120),
  type: z.nativeEnum(CustomFieldType),
  isRequired: z.boolean().optional(),
  options: z.unknown().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const rows = await db.customFieldDef.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      label: true,
      type: true,
      isRequired: true,
      position: true,
      options: true,
    },
  });
  return NextResponse.json(ok(rows, { total: rows.length }));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json(fail("Invalid request body"), { status: 400 });

  const max = await db.customFieldDef.aggregate({ _max: { position: true } });
  const created = await db.customFieldDef.create({
    data: {
      ...parsed.data,
      position: (max._max.position ?? -1) + 1,
      isRequired: parsed.data.isRequired ?? false,
    },
    select: { id: true, name: true, label: true, type: true, isRequired: true, position: true },
  });
  return NextResponse.json(ok(created), { status: 201 });
}
