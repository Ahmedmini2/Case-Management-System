import { ActivityType } from "@prisma/client";
import { db } from "@/lib/prisma";

export async function calculateSlaDueDate(priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW") {
  const policy = await db.sLAPolicy.findUnique({
    where: { priority },
    select: { resolutionHours: true },
  });
  const hours = policy?.resolutionHours ?? 24;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export async function enqueueSlaWarning(caseId: string) {
  const item = await db.case.findUnique({
    where: { id: caseId },
    select: { id: true, dueDate: true },
  });
  if (!item?.dueDate) return null;
  return new Date(item.dueDate.getTime() - 60 * 60 * 1000);
}

export async function runSlaCheck(now = new Date()) {
  const overdue = await db.case.findMany({
    where: {
      dueDate: { lt: now },
      slaBreachedAt: null,
      status: { notIn: ["RESOLVED", "CLOSED", "CANCELLED"] },
    },
    select: { id: true },
  });

  for (const item of overdue) {
    await db.case.update({
      where: { id: item.id },
      data: { slaBreachedAt: now },
    });
    await db.activity.create({
      data: {
        caseId: item.id,
        type: ActivityType.SLA_BREACHED,
        description: "SLA breached",
      },
    });
  }

  return { breached: overdue.length };
}
