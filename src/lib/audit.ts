import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
  const sb = supabaseAdmin();
  const { error } = await sb.from("audit_logs").insert({
    id: randomUUID(),
    userId: userId ?? null,
    caseId: caseId ?? null,
    action,
    resource,
    resourceId: resourceId ?? null,
    before: (before as object | null) ?? null,
    after: (after as object | null) ?? null,
    ipAddress: req?.headers.get("x-forwarded-for") ?? null,
    userAgent: req?.headers.get("user-agent") ?? null,
    createdAt: new Date().toISOString(),
  });
  if (error) {
    console.error("[audit] failed:", error.message);
  }
}
