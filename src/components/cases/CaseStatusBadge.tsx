import { CaseStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  CaseStatus,
  { label: string; dot: string; bg: string; text: string }
> = {
  OPEN: {
    label: "Open",
    dot: "bg-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    text: "text-blue-700 dark:text-blue-300",
  },
  IN_PROGRESS: {
    label: "In Progress",
    dot: "bg-indigo-500",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
    text: "text-indigo-700 dark:text-indigo-300",
  },
  WAITING_ON_CUSTOMER: {
    label: "Waiting – Customer",
    dot: "bg-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
  },
  WAITING_ON_THIRD_PARTY: {
    label: "Waiting – 3rd Party",
    dot: "bg-orange-500",
    bg: "bg-orange-50 dark:bg-orange-950/40",
    text: "text-orange-700 dark:text-orange-300",
  },
  RESOLVED: {
    label: "Resolved",
    dot: "bg-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  CLOSED: {
    label: "Closed",
    dot: "bg-slate-500",
    bg: "bg-slate-50 dark:bg-slate-950/40",
    text: "text-slate-600 dark:text-slate-400",
  },
  CANCELLED: {
    label: "Cancelled",
    dot: "bg-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    text: "text-red-600 dark:text-red-400",
  },
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        cfg.bg,
        cfg.text,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}
