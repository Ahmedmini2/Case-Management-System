import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().nullable().optional(),
  color: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json(fail("Invalid request body"), { status: 400 });

  const updated = await db.team.update({
    where: { id: params.id },
    data: parsed.data,
    select: { id: true, name: true, description: true, color: true },
  });
  return NextResponse.json(ok(updated));
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  await db.team.delete({ where: { id: params.id } });
  return NextResponse.json(ok({ id: params.id }));
}
