import { ActivityType } from "@/types/enums";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function calculateSlaDueDate(priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW") {
  const sb = supabaseAdmin();
  const { data: policy } = await sb
    .from("sla_policies")
    .select("resolutionHours")
    .eq("priority", priority)
    .maybeSingle();
  const hours = (policy as { resolutionHours: number } | null)?.resolutionHours ?? 24;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export async function enqueueSlaWarning(caseId: string) {
  const sb = supabaseAdmin();
  const { data: item } = await sb
    .from("cases")
    .select("id, dueDate")
    .eq("id", caseId)
    .maybeSingle();
  const dueDate = (item as { id: string; dueDate: string | null } | null)?.dueDate ?? null;
  if (!dueDate) return null;
  return new Date(new Date(dueDate).getTime() - 60 * 60 * 1000);
}

export async function runSlaCheck(now = new Date()) {
  const sb = supabaseAdmin();
  const { data: overdueRaw } = await sb
    .from("cases")
    .select("id")
    .lt("dueDate", now.toISOString())
    .is("slaBreachedAt", null)
    .not("status", "in", "(RESOLVED,CLOSED,CANCELLED)");

  const overdue = (overdueRaw ?? []) as { id: string }[];

  for (const item of overdue) {
    const { error: updErr } = await sb
      .from("cases")
      .update({ slaBreachedAt: now.toISOString() })
      .eq("id", item.id);
    if (updErr) {
      console.error("[sla] update failed:", updErr.message);
      continue;
    }
    const { error: actErr } = await sb.from("activities").insert({
      caseId: item.id,
      type: ActivityType.SLA_BREACHED,
      description: "SLA breached",
    });
    if (actErr) {
      console.error("[sla] activity failed:", actErr.message);
    }
  }

  return { breached: overdue.length };
}
