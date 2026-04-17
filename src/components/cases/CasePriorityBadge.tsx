import { Priority } from "@prisma/client";
import { cn } from "@/lib/utils";

const priorityConfig: Record<
  Priority,
  { label: string; dot: string; bg: string; text: string; border: string }
> = {
  CRITICAL: {
    label: "Critical",
    dot: "bg-red-500",
    bg: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-200 dark:border-red-800/50",
  },
  HIGH: {
    label: "High",
    dot: "bg-orange-500",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800/50",
  },
  MEDIUM: {
    label: "Medium",
    dot: "bg-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800/50",
  },
  LOW: {
    label: "Low",
    dot: "bg-slate-400",
    bg: "bg-slate-50 dark:bg-slate-900/40",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-700/50",
  },
};

export function CasePriorityBadge({ priority }: { priority: Priority }) {
  const cfg = priorityConfig[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        cfg.bg,
        cfg.text,
        cfg.border,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
