import { CaseStatus, Priority } from "@/types/enums";
import { enqueueEmailJob } from "@/lib/queue/jobs";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { AutomationAction } from "@/lib/automations/types";

export async function executeAutomationAction(
  action: AutomationAction,
  context: { caseId: string; actorUserId?: string | null },
) {
  const sb = supabaseAdmin();

  switch (action.type) {
    case "CHANGE_STATUS": {
      const status = action.config?.status as CaseStatus | undefined;
      if (!status) return { skipped: true };
      await sb.from("cases").update({ status }).eq("id", context.caseId);
      return { done: true };
    }
    case "CHANGE_PRIORITY": {
      const priority = action.config?.priority as Priority | undefined;
      if (!priority) return { skipped: true };
      await sb.from("cases").update({ priority }).eq("id", context.caseId);
      return { done: true };
    }
    case "CHANGE_STAGE": {
      const pipelineStageId = action.config?.pipelineStageId as string | undefined;
      if (!pipelineStageId) return { skipped: true };
      await sb.from("cases").update({ pipelineStageId }).eq("id", context.caseId);
      return { done: true };
    }
    case "ADD_COMMENT": {
      const body = String(action.config?.body ?? "").trim();
      if (!body || !context.actorUserId) return { skipped: true };
      await sb.from("comments").insert({
        caseId: context.caseId,
        authorId: context.actorUserId,
        body,
        isInternal: true,
      });
      return { done: true };
    }
    case "SEND_EMAIL": {
      const to = action.config?.to as string[] | undefined;
      if (!to?.length) return { skipped: true };
      const { data: caseRow } = await sb
        .from("cases")
        .select("id, caseNumber, title, status, priority")
        .eq("id", context.caseId)
        .maybeSingle();
      const caseItem = caseRow as
        | {
            id: string;
            caseNumber: string;
            title: string;
            status: string;
            priority: string;
          }
        | null;
      if (!caseItem) return { skipped: true };

      const subject = (action.config?.subject as string) ?? `Case update: ${caseItem.caseNumber}`;
      const body = (action.config?.body as string) ?? "Automation notification";
      const { data: emailRow, error: emailErr } = await sb
        .from("emails")
        .insert({
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
        })
        .select("id")
        .single();
      if (emailErr || !emailRow) return { skipped: true };
      const email = emailRow as { id: string };

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
