import { Resend } from "resend";
import { CaseCreatedEmail, caseCreatedText } from "@/lib/email/templates/CaseCreated";

type CaseEmailPayload = {
  to: string[];
  subject: string;
  caseNumber: string;
  caseTitle: string;
  status: string;
  priority: string;
  assignee?: string | null;
  updateMessage?: string;
  caseUrl: string;
};

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendCaseEmail(payload: CaseEmailPayload) {
  if (!resend) {
    return { skipped: true as const };
  }

  const from = process.env.EMAIL_FROM ?? "support@example.com";
  const fromName = process.env.EMAIL_FROM_NAME ?? "Case Management";
  const fromHeader = `${fromName} <${from}>`;

  const data = await resend.emails.send({
    from: fromHeader,
    to: payload.to,
    subject: payload.subject,
    react: CaseCreatedEmail({
      caseNumber: payload.caseNumber,
      caseTitle: payload.caseTitle,
      status: payload.status,
      priority: payload.priority,
      assignee: payload.assignee,
      updateMessage: payload.updateMessage,
      caseUrl: payload.caseUrl,
    }),
    text: caseCreatedText({
      caseNumber: payload.caseNumber,
      caseTitle: payload.caseTitle,
      status: payload.status,
      priority: payload.priority,
      assignee: payload.assignee,
      updateMessage: payload.updateMessage,
      caseUrl: payload.caseUrl,
    }),
  });

  return data;
}
