import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const existing = await db.apiKey.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!existing) return NextResponse.json(fail("API key not found"), { status: 404 });

  await db.apiKey.update({
    where: { id: params.id },
    data: { isActive: false },
  });

  return NextResponse.json(ok({ id: params.id, revoked: true }));
}
