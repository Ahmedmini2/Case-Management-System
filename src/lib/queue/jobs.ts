import { EmailStatus, EmailDir } from "@prisma/client";
import { sendCaseEmail } from "@/lib/email/sender";
import { emailQueue } from "@/lib/queue/client";
import { db } from "@/lib/prisma";

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
  await db.email.update({
    where: { id: payload.emailId },
    data: {
      direction: EmailDir.OUTBOUND,
      status: result && "data" in result && result.data?.id ? EmailStatus.SENT : EmailStatus.PENDING,
      resendId: result && "data" in result ? result.data?.id ?? null : null,
      sentAt: new Date(),
    },
  });
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
