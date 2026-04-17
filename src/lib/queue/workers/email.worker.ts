import { Worker } from "bullmq";
import { processEmailJob, type EmailJobPayload } from "@/lib/queue/jobs";
import { queueConnection } from "@/lib/queue/client";

export function createEmailWorker() {
  if (!queueConnection) return null;
  return new Worker<EmailJobPayload>(
    "email",
    async (job) => {
      await processEmailJob(job.data);
    },
    { connection: queueConnection },
  );
}
