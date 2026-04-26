import { CaseStatus, Priority } from "@/types/enums";
import { unstable_cache } from "next/cache";
import { supabaseAdmin } from "@/lib/supabase/admin";

function getDateRange(range: string | null) {
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from, days };
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

type CaseRow = {
  id: string;
  createdAt: string;
  status: string;
  priority: string;
  source: string;
  assignedToId: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  slaBreachedAt: string | null;
  pipelineStageId: string | null;
};

async function computeReportsData(params: {
  range?: string | null;
  teamId?: string | null;
  agentId?: string | null;
}) {
  const { from, days } = getDateRange(params.range ?? null);
  const sb = supabaseAdmin();

  let casesQuery = sb
    .from("cases")
    .select(
      "id, createdAt, status, priority, source, assignedToId, firstResponseAt, resolvedAt, slaBreachedAt, pipelineStageId",
    )
    .gte("createdAt", from.toISOString())
    .order("createdAt", { ascending: false })
    .limit(2000);
  if (params.teamId) casesQuery = casesQuery.eq("teamId", params.teamId);
  if (params.agentId) casesQuery = casesQuery.eq("assignedToId", params.agentId);

  const [
    { data: casesRaw },
    { data: policiesRaw },
    { data: activitiesRaw },
    { data: usersRaw },
  ] = await Promise.all([
    casesQuery,
    sb.from("sla_policies").select("priority, resolutionHours, firstResponseHours"),
    sb
      .from("activities")
      .select("newValue")
      .gte("createdAt", from.toISOString())
      .eq("type", "TAG_ADDED"),
    sb.from("users").select("id, name"),
  ]);

  const cases = (casesRaw ?? []) as CaseRow[];
  const policies = (policiesRaw ?? []) as {
    priority: string;
    resolutionHours: number;
    firstResponseHours: number;
  }[];
  const activities = (activitiesRaw ?? []) as { newValue: string | null }[];
  const users = (usersRaw ?? []) as { id: string; name: string | null }[];

  // Hydrate pipeline stage names
  const stageIds = [
    ...new Set(cases.map((c) => c.pipelineStageId).filter(Boolean) as string[]),
  ];
  const stageNameById = new Map<string, string>();
  if (stageIds.length > 0) {
    const { data: stagesRaw } = await sb
      .from("pipeline_stages")
      .select("id, name")
      .in("id", stageIds);
    for (const s of (stagesRaw ?? []) as { id: string; name: string }[]) {
      stageNameById.set(s.id, s.name);
    }
  }

  const total = cases.length;
  const byStatus = Object.values(CaseStatus).map((status) => ({
    status,
    count: cases.filter((item) => item.status === status).length,
  }));

  const bySourceMap = new Map<string, number>();
  for (const item of cases) bySourceMap.set(item.source, (bySourceMap.get(item.source) ?? 0) + 1);
  const bySource = Array.from(bySourceMap.entries()).map(([source, count]) => ({ source, count }));

  const byDayMap = new Map<string, number>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    byDayMap.set(dayKey(d), 0);
  }
  for (const item of cases) {
    const key = dayKey(new Date(item.createdAt));
    if (byDayMap.has(key)) byDayMap.set(key, (byDayMap.get(key) ?? 0) + 1);
  }
  const casesOverTime = Array.from(byDayMap.entries()).map(([date, count]) => ({ date, count }));

  const avgResolutionByPriority = Object.values(Priority).map((priority) => {
    const rows = cases.filter((c) => c.priority === priority && c.resolvedAt);
    const avgHours =
      rows.reduce(
        (acc, row) => acc + (new Date(row.resolvedAt!).getTime() - new Date(row.createdAt).getTime()),
        0,
      ) /
      (rows.length || 1) /
      36e5;
    return { priority, avgHours: Number(avgHours.toFixed(2)) };
  });

  const firstResponseByAgent = users.map((user) => {
    const rows = cases.filter((c) => c.assignedToId === user.id && c.firstResponseAt);
    const avgHours =
      rows.reduce(
        (acc, row) =>
          acc + (new Date(row.firstResponseAt!).getTime() - new Date(row.createdAt).getTime()),
        0,
      ) /
      (rows.length || 1) /
      36e5;
    return { agentId: user.id, agentName: user.name ?? "Unknown", avgHours: Number(avgHours.toFixed(2)) };
  });

  const slaPolicyMap = new Map(policies.map((p) => [p.priority, p.resolutionHours]));
  const slaCompliant = cases.filter((c) => {
    if (!c.resolvedAt) return true;
    const limit = slaPolicyMap.get(c.priority) ?? 24;
    return (new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime()) / 36e5 <= limit;
  }).length;
  const slaComplianceRate = total ? Number(((slaCompliant / total) * 100).toFixed(2)) : 100;

  const agentPerformance = users.map((user) => {
    const assigned = cases.filter((c) => c.assignedToId === user.id);
    const resolved = assigned.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED");
    const avgResolutionHours =
      resolved.reduce((acc, c) => {
        if (!c.resolvedAt) return acc;
        return acc + (new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime()) / 36e5;
      }, 0) / (resolved.length || 1);
    return {
      agentId: user.id,
      agentName: user.name ?? "Unknown",
      assignedCount: assigned.length,
      resolvedCount: resolved.length,
      avgResolutionHours: Number(avgResolutionHours.toFixed(2)),
    };
  });

  const pipelineFunnelMap = new Map<string, number>();
  for (const c of cases) {
    const stage = c.pipelineStageId ? stageNameById.get(c.pipelineStageId) ?? "Unstaged" : "Unstaged";
    pipelineFunnelMap.set(stage, (pipelineFunnelMap.get(stage) ?? 0) + 1);
  }
  const pipelineFunnel = Array.from(pipelineFunnelMap.entries()).map(([stage, count]) => ({ stage, count }));

  const tagMap = new Map<string, number>();
  for (const a of activities) {
    if (!a.newValue) continue;
    tagMap.set(a.newValue, (tagMap.get(a.newValue) ?? 0) + 1);
  }
  const tagFrequency = Array.from(tagMap.entries()).map(([tag, count]) => ({ tag, count }));

  // WhatsApp stats
  const [
    { count: waTotal },
    { count: waAI },
    { count: waHuman },
    { count: waUnread },
  ] = await Promise.all([
    sb.from("whatsapp_conversations").select("*", { count: "exact", head: true }),
    sb
      .from("whatsapp_conversations")
      .select("*", { count: "exact", head: true })
      .eq("handledBy", "AI"),
    sb
      .from("whatsapp_conversations")
      .select("*", { count: "exact", head: true })
      .eq("handledBy", "HUMAN"),
    sb
      .from("whatsapp_conversations")
      .select("*", { count: "exact", head: true })
      .gt("unreadCount", 0),
  ]);

  // Broadcast stats
  const { data: broadcastsRaw } = await sb
    .from("broadcasts")
    .select(
      "id, name, status, totalCount, sentCount, deliveredCount, failedCount, readCount, createdAt, completedAt",
    )
    .order("createdAt", { ascending: false })
    .limit(50);

  const allBroadcasts = (broadcastsRaw ?? []) as {
    id: string;
    name: string;
    status: string;
    totalCount: number;
    sentCount: number;
    deliveredCount: number;
    failedCount: number;
    readCount: number;
    createdAt: string;
    completedAt: string | null;
  }[];

  const broadcastStats = {
    totalBroadcasts: allBroadcasts.length,
    totalRecipients: allBroadcasts.reduce((s, b) => s + b.totalCount, 0),
    totalSent: allBroadcasts.reduce((s, b) => s + b.sentCount, 0),
    totalDelivered: allBroadcasts.reduce((s, b) => s + b.deliveredCount, 0),
    totalRead: allBroadcasts.reduce((s, b) => s + b.readCount, 0),
    totalFailed: allBroadcasts.reduce((s, b) => s + b.failedCount, 0),
    deliveryRate: 0,
    readRate: 0,
    recentBroadcasts: allBroadcasts.slice(0, 5).map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      totalCount: b.totalCount,
      sentCount: b.sentCount,
      deliveredCount: b.deliveredCount,
      readCount: b.readCount,
      failedCount: b.failedCount,
      createdAt: b.createdAt,
      completedAt: b.completedAt,
    })),
  };

  if (broadcastStats.totalSent > 0) {
    broadcastStats.deliveryRate = Math.round((broadcastStats.totalDelivered / broadcastStats.totalSent) * 100);
    broadcastStats.readRate = Math.round((broadcastStats.totalRead / broadcastStats.totalSent) * 100);
  }

  return {
    totals: {
      totalCases: total,
      open: byStatus.find((s) => s.status === "OPEN")?.count ?? 0,
      inProgress: byStatus.find((s) => s.status === "IN_PROGRESS")?.count ?? 0,
      closed:
        (byStatus.find((s) => s.status === "CLOSED")?.count ?? 0) +
        (byStatus.find((s) => s.status === "RESOLVED")?.count ?? 0),
    },
    whatsapp: {
      total: waTotal ?? 0,
      ai: waAI ?? 0,
      human: waHuman ?? 0,
      unread: waUnread ?? 0,
    },
    broadcast: broadcastStats,
    byStatus,
    casesOverTime,
    firstResponseByAgent,
    avgResolutionByPriority,
    slaComplianceRate,
    bySource,
    agentPerformance,
    pipelineFunnel,
    tagFrequency,
  };
}

export async function getReportsData(params: {
  range?: string | null;
  teamId?: string | null;
  agentId?: string | null;
}) {
  const keyRange = params.range ?? "30d";
  const keyTeam = params.teamId ?? "all";
  const keyAgent = params.agentId ?? "all";

  const cached = unstable_cache(
    async () =>
      computeReportsData({
        range: keyRange,
        teamId: keyTeam === "all" ? null : keyTeam,
        agentId: keyAgent === "all" ? null : keyAgent,
      }),
    ["reports", keyRange, keyTeam, keyAgent],
    { revalidate: 20 },
  );

  return cached();
}
