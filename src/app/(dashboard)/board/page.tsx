import Link from "next/link";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { Map } from "lucide-react";

async function getOrCreateDefaultPipeline() {
  // Single query: find the default pipeline with all data needed
  let pipeline = await db.pipeline.findFirst({
    where: { isDefault: true },
    select: {
      id: true,
      name: true,
      stages: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          position: true,
          cases: {
            orderBy: { updatedAt: "desc" },
            take: 100,
            select: {
              id: true,
              caseNumber: true,
              title: true,
              priority: true,
              dueDate: true,
              assignedTo: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (pipeline) return pipeline;

  // No default pipeline — find any pipeline with cases, or create one
  const anyWithCases = await db.pipeline.findFirst({
    where: { cases: { some: {} } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const targetId = anyWithCases?.id ?? (await db.pipeline.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  }))?.id;

  if (targetId) {
    await db.pipeline.updateMany({ data: { isDefault: false } });
    await db.pipeline.update({ where: { id: targetId }, data: { isDefault: true } });
  } else {
    // Create a default pipeline
    await db.pipeline.create({
      data: {
        name: "Default Pipeline",
        isDefault: true,
        stages: {
          create: [
            { name: "Backlog", color: "#6366f1", position: 0 },
            { name: "In Progress", color: "#0ea5e9", position: 1 },
            { name: "Done", color: "#22c55e", position: 2, isTerminal: true },
          ],
        },
      },
    });
  }

  // Fetch freshly set default
  pipeline = await db.pipeline.findFirst({
    where: { isDefault: true },
    select: {
      id: true,
      name: true,
      stages: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          color: true,
          position: true,
          cases: {
            orderBy: { updatedAt: "desc" },
            take: 100,
            select: {
              id: true,
              caseNumber: true,
              title: true,
              priority: true,
              dueDate: true,
              assignedTo: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  return pipeline;
}

export default async function BoardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const pipeline = await getOrCreateDefaultPipeline();

  if (!pipeline) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-sm text-muted-foreground">No pipeline found.</p>
        <Link href="/pipeline/new" className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors">
          Create Pipeline
        </Link>
      </div>
    );
  }

  // Backfill cases with no pipeline assignment (fire-and-forget, non-blocking)
  const firstStageId = pipeline.stages[0]?.id;
  if (firstStageId) {
    // Run without await so it doesn't block page render
    void db.case.updateMany({
      where: { OR: [{ pipelineId: null }, { pipelineStageId: null }] },
      data: { pipelineId: pipeline.id, pipelineStageId: firstStageId },
    }).catch(() => {/* non-critical */});
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Map className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{pipeline.name}</h1>
            <p className="text-xs text-muted-foreground">
              {pipeline.stages.reduce((s, col) => s + col.cases.length, 0)} cases across {pipeline.stages.length} stages
            </p>
          </div>
        </div>
        <Link href={`/pipeline/${pipeline.id}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
          Manage Pipeline
        </Link>
      </div>
      <KanbanBoard
        initial={{
          id: pipeline.id,
          name: pipeline.name,
          stages: pipeline.stages.map((stage) => ({
            ...stage,
            cases: stage.cases.map((item) => ({
              ...item,
              dueDate: item.dueDate?.toISOString() ?? null,
            })),
          })),
        }}
      />
    </div>
  );
}
