import type { AutomationCondition } from "@/lib/automations/types";

function valueFromPath(data: Record<string, unknown>, path: string) {
  return path.split(".").reduce<unknown>((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, data);
}

export function evaluateConditions(
  data: Record<string, unknown>,
  conditions: AutomationCondition[] = [],
) {
  return conditions.every((condition) => {
    const current = valueFromPath(data, condition.field);
    const expected = condition.value;

    switch (condition.operator) {
      case "equals":
        return current === expected;
      case "not_equals":
        return current !== expected;
      case "contains":
        return String(current ?? "").includes(String(expected ?? ""));
      case "not_contains":
        return !String(current ?? "").includes(String(expected ?? ""));
      case "greater_than":
        return Number(current ?? 0) > Number(expected ?? 0);
      case "less_than":
        return Number(current ?? 0) < Number(expected ?? 0);
      case "is_empty":
        return current === null || current === undefined || current === "";
      case "is_not_empty":
        return !(current === null || current === undefined || current === "");
      case "in":
        return Array.isArray(expected) ? expected.includes(current) : false;
      case "not_in":
        return Array.isArray(expected) ? !expected.includes(current) : true;
      default:
        return false;
    }
  });
}
