import { RunStatus } from "@/types/enums";
import { executeAutomationAction } from "@/lib/automations/actions";
import { evaluateConditions } from "@/lib/automations/triggers";
import type { AutomationAction, AutomationTrigger, AutomationTriggerType } from "@/lib/automations/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function runAutomationEngine(params: {
  triggerType: AutomationTriggerType;
  caseId: string;
  actorUserId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const sb = supabaseAdmin();

  const { data: automationsRaw } = await sb
    .from("automations")
    .select("id, trigger, actions, runCount")
    .eq("isActive", true);

  const automations = (automationsRaw ?? []) as {
    id: string;
    trigger: unknown;
    actions: unknown;
    runCount: number;
  }[];

  const { data: caseRow } = await sb
    .from("cases")
    .select(
      "id, caseNumber, title, status, priority, assignedToId, pipelineStageId, dueDate, slaBreachedAt",
    )
    .eq("id", params.caseId)
    .maybeSingle();

  const caseData = caseRow as
    | {
        id: string;
        caseNumber: string;
        title: string;
        status: string;
        priority: string;
        assignedToId: string | null;
        pipelineStageId: string | null;
        dueDate: string | null;
        slaBreachedAt: string | null;
      }
    | null;

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

    const { data: runRow, error: runErr } = await sb
      .from("automation_runs")
      .insert({
        automationId: automation.id,
        caseId: params.caseId,
        status: RunStatus.RUNNING,
      })
      .select("id")
      .single();

    if (runErr || !runRow) {
      console.error("[automation] run create failed:", runErr?.message);
      continue;
    }
    const runId = (runRow as { id: string }).id;

    try {
      const actions = automation.actions as unknown as AutomationAction[];
      for (const action of actions) {
        await executeAutomationAction(action, {
          caseId: params.caseId,
          actorUserId: params.actorUserId,
        });
      }

      await sb
        .from("automation_runs")
        .update({ status: RunStatus.SUCCESS, result: { actions: actions.length } })
        .eq("id", runId);
      executed += 1;
    } catch (error) {
      await sb
        .from("automation_runs")
        .update({
          status: RunStatus.FAILED,
          error: error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", runId);
    }

    await sb
      .from("automations")
      .update({
        runCount: (automation.runCount ?? 0) + 1,
        lastRunAt: new Date().toISOString(),
      })
      .eq("id", automation.id);
  }

  return { matched, executed };
}
