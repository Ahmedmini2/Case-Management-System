// Local enums replacing imports from @prisma/client.
// Mirror the Postgres enum definitions exactly.

export const UserRole = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  AGENT: "AGENT",
  VIEWER: "VIEWER",
  CUSTOMER: "CUSTOMER",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const TeamRole = {
  LEAD: "LEAD",
  MEMBER: "MEMBER",
} as const;
export type TeamRole = (typeof TeamRole)[keyof typeof TeamRole];

export const CaseStatus = {
  OPEN: "OPEN",
  IN_PROGRESS: "IN_PROGRESS",
  WAITING_ON_CUSTOMER: "WAITING_ON_CUSTOMER",
  WAITING_ON_THIRD_PARTY: "WAITING_ON_THIRD_PARTY",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
} as const;
export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];

export const Priority = {
  CRITICAL: "CRITICAL",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];

export const CaseSource = {
  MANUAL: "MANUAL",
  EMAIL: "EMAIL",
  ZAPIER: "ZAPIER",
  API: "API",
  PORTAL: "PORTAL",
  PHONE: "PHONE",
  CHAT: "CHAT",
} as const;
export type CaseSource = (typeof CaseSource)[keyof typeof CaseSource];

export const ActivityType = {
  CREATED: "CREATED",
  STATUS_CHANGED: "STATUS_CHANGED",
  PRIORITY_CHANGED: "PRIORITY_CHANGED",
  ASSIGNED: "ASSIGNED",
  UNASSIGNED: "UNASSIGNED",
  TAG_ADDED: "TAG_ADDED",
  TAG_REMOVED: "TAG_REMOVED",
  COMMENT_ADDED: "COMMENT_ADDED",
  EMAIL_SENT: "EMAIL_SENT",
  EMAIL_RECEIVED: "EMAIL_RECEIVED",
  STAGE_CHANGED: "STAGE_CHANGED",
  ATTACHMENT_ADDED: "ATTACHMENT_ADDED",
  FIELD_UPDATED: "FIELD_UPDATED",
  DUE_DATE_SET: "DUE_DATE_SET",
  SLA_BREACHED: "SLA_BREACHED",
  AUTOMATION_TRIGGERED: "AUTOMATION_TRIGGERED",
  MERGED: "MERGED",
} as const;
export type ActivityType = (typeof ActivityType)[keyof typeof ActivityType];

export const EmailDir = {
  INBOUND: "INBOUND",
  OUTBOUND: "OUTBOUND",
} as const;
export type EmailDir = (typeof EmailDir)[keyof typeof EmailDir];

export const EmailStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  OPENED: "OPENED",
  BOUNCED: "BOUNCED",
  FAILED: "FAILED",
} as const;
export type EmailStatus = (typeof EmailStatus)[keyof typeof EmailStatus];

export const RunStatus = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const CustomFieldType = {
  TEXT: "TEXT",
  NUMBER: "NUMBER",
  DATE: "DATE",
  SELECT: "SELECT",
  MULTISELECT: "MULTISELECT",
  BOOLEAN: "BOOLEAN",
  URL: "URL",
} as const;
export type CustomFieldType = (typeof CustomFieldType)[keyof typeof CustomFieldType];

export const ConvStatus = {
  ACTIVE: "ACTIVE",
  WAITING: "WAITING",
  RESOLVED: "RESOLVED",
  BLOCKED: "BLOCKED",
} as const;
export type ConvStatus = (typeof ConvStatus)[keyof typeof ConvStatus];

export const HandledBy = {
  AI: "AI",
  HUMAN: "HUMAN",
} as const;
export type HandledBy = (typeof HandledBy)[keyof typeof HandledBy];

export const TemplateStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PAUSED: "PAUSED",
  DISABLED: "DISABLED",
} as const;
export type TemplateStatus = (typeof TemplateStatus)[keyof typeof TemplateStatus];

export const BroadcastStatus = {
  DRAFT: "DRAFT",
  SCHEDULED: "SCHEDULED",
  SENDING: "SENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
} as const;
export type BroadcastStatus = (typeof BroadcastStatus)[keyof typeof BroadcastStatus];

export const RecipientStatus = {
  PENDING: "PENDING",
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  READ: "READ",
  FAILED: "FAILED",
} as const;
export type RecipientStatus = (typeof RecipientStatus)[keyof typeof RecipientStatus];
