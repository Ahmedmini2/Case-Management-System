import { UserRole } from "@prisma/client";

export type PermissionKey =
  | "cases.read"
  | "cases.create"
  | "cases.update"
  | "cases.comment"
  | "teams.manage"
  | "automations.manage"
  | "reports.view"
  | "audit.delete";

const rolePermissions: Record<UserRole, PermissionKey[]> = {
  SUPER_ADMIN: [
    "cases.read",
    "cases.create",
    "cases.update",
    "cases.comment",
    "teams.manage",
    "automations.manage",
    "reports.view",
    "audit.delete",
  ],
  ADMIN: [
    "cases.read",
    "cases.create",
    "cases.update",
    "cases.comment",
    "teams.manage",
    "automations.manage",
    "reports.view",
  ],
  MANAGER: [
    "cases.read",
    "cases.create",
    "cases.update",
    "cases.comment",
    "teams.manage",
    "automations.manage",
    "reports.view",
  ],
  AGENT: ["cases.read", "cases.create", "cases.update", "cases.comment"],
  VIEWER: ["cases.read"],
  CUSTOMER: [],
};

export function hasPermission(role: UserRole, permission: PermissionKey) {
  return rolePermissions[role].includes(permission);
}

export function getPermissionMatrix() {
  return rolePermissions;
}
