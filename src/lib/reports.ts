import { CaseStatus, Priority } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/prisma";

function getDateRange(range: string | null) {
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const from = new Date();
  from.setDate(from.getDate() - days);
  return { from, days };
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function computeReportsData(params: {
  range?: string | null;
  teamId?: string | null;
  agentId?: string | null;
}) {
  const { from, days } = getDateRange(params.range ?? null);
  const where = {
    createdAt: { gte: from },
    ...(params.teamId ? { teamId: params.teamId } : {}),
    ...(params.agentId ? { assignedToId: params.agentId } : {}),
  };

  const [cases, policies, activities, users] = await Promise.all([
    db.case.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 2000,
      select: {
        id: true,
        createdAt: true,
        status: true,
        priority: true,
        source: true,
        assignedToId: true,
        firstResponseAt: true,
        resolvedAt: true,
        slaBreachedAt: true,
        pipelineStage: { select: { name: true } },
      },
    }),
    db.sLAPolicy.findMany({
      select: { priority: true, resolutionHours: true, firstResponseHours: true },
    }),
    db.activity.findMany({
      where: { createdAt: { gte: from }, type: "TAG_ADDED" },
      select: { newValue: true },
    }),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);

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
    const key = dayKey(item.createdAt);
    if (byDayMap.has(key)) byDayMap.set(key, (byDayMap.get(key) ?? 0) + 1);
  }
  const casesOverTime = Array.from(byDayMap.entries()).map(([date, count]) => ({ date, count }));

  const avgResolutionByPriority = Object.values(Priority).map((priority) => {
    const rows = cases.filter((c) => c.priority === priority && c.resolvedAt);
    const avgHours =
      rows.reduce((acc, row) => acc + (row.resolvedAt!.getTime() - row.createdAt.getTime()), 0) /
      (rows.length || 1) /
      36e5;
    return { priority, avgHours: Number(avgHours.toFixed(2)) };
  });

  const firstResponseByAgent = users.map((user) => {
    const rows = cases.filter((c) => c.assignedToId === user.id && c.firstResponseAt);
    const avgHours =
      rows.reduce((acc, row) => acc + (row.firstResponseAt!.getTime() - row.createdAt.getTime()), 0) /
      (rows.length || 1) /
      36e5;
    return { agentId: user.id, agentName: user.name ?? "Unknown", avgHours: Number(avgHours.toFixed(2)) };
  });

  const slaPolicyMap = new Map(policies.map((p) => [p.priority, p.resolutionHours]));
  const slaCompliant = cases.filter((c) => {
    if (!c.resolvedAt) return true;
    const limit = slaPolicyMap.get(c.priority) ?? 24;
    return (c.resolvedAt.getTime() - c.createdAt.getTime()) / 36e5 <= limit;
  }).length;
  const slaComplianceRate = total ? Number(((slaCompliant / total) * 100).toFixed(2)) : 100;

  const agentPerformance = users.map((user) => {
    const assigned = cases.filter((c) => c.assignedToId === user.id);
    const resolved = assigned.filter((c) => c.status === "RESOLVED" || c.status === "CLOSED");
    const avgResolutionHours =
      resolved.reduce((acc, c) => {
        if (!c.resolvedAt) return acc;
        return acc + (c.resolvedAt.getTime() - c.createdAt.getTime()) / 36e5;
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
    const stage = c.pipelineStage?.name ?? "Unstaged";
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
  const [waTotal, waAI, waHuman, waUnread] = await Promise.all([
    db.whatsAppConversation.count(),
    db.whatsAppConversation.count({ where: { handledBy: "AI" } }),
    db.whatsAppConversation.count({ where: { handledBy: "HUMAN" } }),
    db.whatsAppConversation.count({ where: { unreadCount: { gt: 0 } } }),
  ]);

  // Broadcast stats
  const allBroadcasts = await db.broadcast.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      totalCount: true,
      sentCount: true,
      deliveredCount: true,
      failedCount: true,
      readCount: true,
      createdAt: true,
      completedAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

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
      createdAt: b.createdAt.toISOString(),
      completedAt: b.completedAt?.toISOString() ?? null,
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
    whatsapp: { total: waTotal, ai: waAI, human: waHuman, unread: waUnread },
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
