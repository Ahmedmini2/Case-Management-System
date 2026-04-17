import { RunStatus } from "@prisma/client";
import { executeAutomationAction } from "@/lib/automations/actions";
import { evaluateConditions } from "@/lib/automations/triggers";
import type { AutomationAction, AutomationTrigger, AutomationTriggerType } from "@/lib/automations/types";
import { db } from "@/lib/prisma";

export async function runAutomationEngine(params: {
  triggerType: AutomationTriggerType;
  caseId: string;
  actorUserId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const automations = await db.automation.findMany({
    where: { isActive: true },
    select: { id: true, trigger: true, actions: true },
  });

  const caseData = await db.case.findUnique({
    where: { id: params.caseId },
    select: {
      id: true,
      caseNumber: true,
      title: true,
      status: true,
      priority: true,
      assignedToId: true,
      pipelineStageId: true,
      dueDate: true,
      slaBreachedAt: true,
    },
  });
  if (!caseData) return { matched: 0, executed: 0 };

  let matched = 0;
  let executed = 0;

  for (const automation of automations) {
    const trigger = automation.trigger as unknown as AutomationTrigger;
    if (trigger.type !== params.triggerType) continue;

    const context = { ...caseData, ...(params.payload ?? {}) } as Record<string, unknown>;
    const conditionMatch = evaluateConditions(context, trigger.conditions ?? []);
    if (!conditionMatch) continue;
    matched += 1;

    const run = await db.automationRun.create({
      data: {
        automationId: automation.id,
        caseId: params.caseId,
        status: RunStatus.RUNNING,
      },
      select: { id: true },
    });

    try {
      const actions = automation.actions as unknown as AutomationAction[];
      for (const action of actions) {
        await executeAutomationAction(action, {
          caseId: params.caseId,
          actorUserId: params.actorUserId,
        });
      }

      await db.automationRun.update({
        where: { id: run.id },
        data: { status: RunStatus.SUCCESS, result: { actions: actions.length } },
      });
      executed += 1;
    } catch (error) {
      await db.automationRun.update({
        where: { id: run.id },
        data: { status: RunStatus.FAILED, error: error instanceof Error ? error.message : "Unknown error" },
      });
    }

    await db.automation.update({
      where: { id: automation.id },
      data: { runCount: { increment: 1 }, lastRunAt: new Date() },
    });
  }

  return { matched, executed };
}
