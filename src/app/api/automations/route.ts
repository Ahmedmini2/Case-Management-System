import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

const automationSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  trigger: z.object({
    type: z.string(),
    conditions: z.array(z.object({ field: z.string(), operator: z.string(), value: z.unknown().optional() })).optional(),
  }),
  actions: z.array(z.object({ type: z.string(), config: z.record(z.unknown()).optional() })),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const data = await db.automation.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      trigger: true,
      actions: true,
      runCount: true,
      lastRunAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json(ok(data, { total: data.length }));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const parsed = automationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json(fail("Invalid request body"), { status: 400 });

  const created = await db.automation.create({
    data: parsed.data,
    select: { id: true, name: true, isActive: true, createdAt: true },
  });
  return NextResponse.json(ok(created), { status: 201 });
}
