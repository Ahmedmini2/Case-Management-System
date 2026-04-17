import { db } from "@/lib/prisma";

export async function generateCaseNumber(): Promise<string> {
  return db.$transaction(async (tx) => {
    const count = await tx.case.count();
    const next = count + 1;
    return `CASE-${String(next).padStart(5, "0")}`;
  });
}
