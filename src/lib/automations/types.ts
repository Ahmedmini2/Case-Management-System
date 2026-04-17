export type AutomationTriggerType =
  | "CASE_CREATED"
  | "CASE_STATUS_CHANGED"
  | "CASE_PRIORITY_CHANGED"
  | "CASE_ASSIGNED"
  | "STAGE_CHANGED"
  | "COMMENT_ADDED"
  | "TAG_ADDED"
  | "SLA_BREACHED"
  | "INCOMING_WEBHOOK"
  | "TIME_BASED";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "is_empty"
  | "is_not_empty"
  | "in"
  | "not_in";

export type AutomationCondition = {
  field: string;
  operator: ConditionOperator;
  value?: unknown;
};

export type AutomationActionType =
  | "SEND_EMAIL"
  | "SEND_NOTIFICATION"
  | "CHANGE_STATUS"
  | "CHANGE_PRIORITY"
  | "ASSIGN_TO"
  | "ADD_TAG"
  | "REMOVE_TAG"
  | "CHANGE_STAGE"
  | "ADD_COMMENT"
  | "SEND_WEBHOOK"
  | "SEND_SLACK"
  | "CREATE_FOLLOW_UP";

export type AutomationAction = {
  type: AutomationActionType;
  config?: Record<string, unknown>;
};

export type AutomationTrigger = {
  type: AutomationTriggerType;
  conditions?: AutomationCondition[];
};
