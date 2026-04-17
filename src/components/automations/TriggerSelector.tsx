"use client";

const triggers = [
  "CASE_CREATED",
  "CASE_STATUS_CHANGED",
  "CASE_PRIORITY_CHANGED",
  "CASE_ASSIGNED",
  "STAGE_CHANGED",
  "COMMENT_ADDED",
  "TAG_ADDED",
  "SLA_BREACHED",
  "INCOMING_WEBHOOK",
  "TIME_BASED",
];

export function TriggerSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
    >
      {triggers.map((trigger) => (
        <option key={trigger} value={trigger}>
          {trigger}
        </option>
      ))}
    </select>
  );
}
