import { Worker } from "bullmq";
import { queueConnection } from "@/lib/queue/client";

export function createAutomationWorker() {
  if (!queueConnection) return null;
  return new Worker(
    "automation",
    async () => {
      // Phase 6 will implement automation workers.
    },
    { connection: queueConnection },
  );
}
