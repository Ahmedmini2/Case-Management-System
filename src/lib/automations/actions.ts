import { CaseStatus, Priority } from "@prisma/client";
import { enqueueEmailJob } from "@/lib/queue/jobs";
import { db } from "@/lib/prisma";
import type { AutomationAction } from "@/lib/automations/types";

export async function executeAutomationAction(
  action: AutomationAction,
  context: { caseId: string; actorUserId?: string | null },
) {
  switch (action.type) {
    case "CHANGE_STATUS": {
      const status = action.config?.status as CaseStatus | undefined;
      if (!status) return { skipped: true };
      await db.case.update({ where: { id: context.caseId }, data: { status } });
      return { done: true };
    }
    case "CHANGE_PRIORITY": {
      const priority = action.config?.priority as Priority | undefined;
      if (!priority) return { skipped: true };
      await db.case.update({ where: { id: context.caseId }, data: { priority } });
      return { done: true };
    }
    case "CHANGE_STAGE": {
      const pipelineStageId = action.config?.pipelineStageId as string | undefined;
      if (!pipelineStageId) return { skipped: true };
      await db.case.update({ where: { id: context.caseId }, data: { pipelineStageId } });
      return { done: true };
    }
    case "ADD_COMMENT": {
      const body = String(action.config?.body ?? "").trim();
      if (!body || !context.actorUserId) return { skipped: true };
      await db.comment.create({
        data: {
          caseId: context.caseId,
          authorId: context.actorUserId,
          body,
          isInternal: true,
        },
      });
      return { done: true };
    }
    case "SEND_EMAIL": {
      const to = action.config?.to as string[] | undefined;
      if (!to?.length) return { skipped: true };
      const caseItem = await db.case.findUnique({
        where: { id: context.caseId },
        select: { id: true, caseNumber: true, title: true, status: true, priority: true },
      });
      if (!caseItem) return { skipped: true };

      const subject = (action.config?.subject as string) ?? `Case update: ${caseItem.caseNumber}`;
      const body = (action.config?.body as string) ?? "Automation notification";
      const email = await db.email.create({
        data: {
          caseId: caseItem.id,
          subject,
          body,
          bodyText: body,
          direction: "OUTBOUND",
          from: process.env.EMAIL_FROM ?? "support@example.com",
          to,
          cc: [],
          bcc: [],
          status: "PENDING",
        },
        select: { id: true },
      });

      await enqueueEmailJob({
        emailId: email.id,
        to,
        subject,
        caseNumber: caseItem.caseNumber,
        caseTitle: caseItem.title,
        status: caseItem.status,
        priority: caseItem.priority,
        caseUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/cases/${caseItem.id}`,
        updateMessage: body,
      });
      return { done: true };
    }
    default:
      return { skipped: true };
  }
}
