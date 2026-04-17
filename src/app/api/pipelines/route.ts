import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { db } from "@/lib/prisma";

const createPipelineSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  isDefault: z.boolean().optional(),
  stages: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        color: z.string().default("#6366f1"),
      }),
    )
    .min(1)
    .optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const pipelines = await db.pipeline.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      isDefault: true,
      stages: {
        orderBy: { position: "asc" },
        select: { id: true, name: true, color: true, position: true, isTerminal: true },
      },
      _count: { select: { cases: true } },
    },
  });

  return NextResponse.json(ok(pipelines, { total: pipelines.length }));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const body = await request.json();
  const parsed = createPipelineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("Invalid request body"), { status: 400 });
  }

  const pipeline = await db.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.pipeline.updateMany({ data: { isDefault: false } });
    }

    return tx.pipeline.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        isDefault: Boolean(parsed.data.isDefault),
        stages: {
          create: (parsed.data.stages ?? [
            { name: "Backlog", color: "#6366f1" },
            { name: "In Progress", color: "#0ea5e9" },
            { name: "Done", color: "#22c55e" },
          ]).map((stage, idx) => ({
            name: stage.name,
            color: stage.color,
            position: idx,
          })),
        },
      },
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
      },
    });
  });

  await writeAudit({
    userId: session.user.id,
    action: "PIPELINE_CREATED",
    resource: "pipeline",
    resourceId: pipeline.id,
    after: pipeline,
    req: request,
  });

  return NextResponse.json(ok(pipeline), { status: 201 });
}
