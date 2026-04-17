import { db } from "@/lib/prisma";

type AuditParams = {
  userId?: string | null;
  caseId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  req?: Request;
};

export async function writeAudit({
  userId,
  caseId,
  action,
  resource,
  resourceId,
  before,
  after,
  req,
}: AuditParams) {
  await db.auditLog.create({
    data: {
      userId: userId ?? null,
      caseId: caseId ?? null,
      action,
      resource,
      resourceId: resourceId ?? null,
      before: before as object | null,
      after: after as object | null,
      ipAddress: req?.headers.get("x-forwarded-for") ?? null,
      userAgent: req?.headers.get("user-agent") ?? null,
    },
  });
}
