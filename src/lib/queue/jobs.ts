import { EmailStatus, EmailDir } from "@/types/enums";
import { sendCaseEmail } from "@/lib/email/sender";
import { emailQueue } from "@/lib/queue/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type EmailJobPayload = {
  emailId: string;
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

export async function processEmailJob(payload: EmailJobPayload) {
  const result = await sendCaseEmail(payload);
  const sb = supabaseAdmin();
  const sentId =
    result && "data" in result && result.data?.id ? result.data.id : null;
  await sb
    .from("emails")
    .update({
      direction: EmailDir.OUTBOUND,
      status: sentId ? EmailStatus.SENT : EmailStatus.PENDING,
      resendId: sentId,
      sentAt: new Date().toISOString(),
    })
    .eq("id", payload.emailId);
}

export async function enqueueEmailJob(payload: EmailJobPayload) {
  if (!emailQueue) {
    await processEmailJob(payload);
    return { queued: false };
  }

  try {
    await emailQueue.add("email.send", payload, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 1000,
    });
    return { queued: true };
  } catch {
    await processEmailJob(payload);
    return { queued: false, fallback: true };
  }
}
