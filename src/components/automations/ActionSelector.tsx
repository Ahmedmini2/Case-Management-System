"use client";

const actions = ["SEND_EMAIL", "CHANGE_STATUS", "CHANGE_PRIORITY", "CHANGE_STAGE", "ADD_COMMENT"];

export function ActionSelector({
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
      {actions.map((action) => (
        <option key={action} value={action}>
          {action}
        </option>
      ))}
    </select>
  );
}
