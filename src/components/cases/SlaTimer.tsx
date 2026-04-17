"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  dueDate: string | null;
  slaBreachedAt: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
};

function formatDuration(ms: number) {
  if (ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function SlaTimer({ dueDate, slaBreachedAt, resolvedAt, closedAt }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Only tick if there's an active due date
    if (!dueDate || slaBreachedAt || resolvedAt || closedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [dueDate, slaBreachedAt, resolvedAt, closedAt]);

  if (!dueDate) return null;

  const due = new Date(dueDate).getTime();
  const isBreached = !!slaBreachedAt || now > due;
  const isClosed = !!(resolvedAt ?? closedAt);
  const msRemaining = due - now;
  const isWarning = !isBreached && msRemaining < 3600 * 1000; // < 1h warning

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">SLA</p>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
          isBreached && !isClosed
            ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
            : isClosed
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400"
            : isWarning
            ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400"
            : "border-primary/20 bg-primary/5 text-primary",
        )}
      >
        {isBreached && !isClosed ? (
          <>
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>SLA Breached</span>
          </>
        ) : isClosed ? (
          <>
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Resolved within SLA</span>
          </>
        ) : (
          <>
            <Clock className="h-4 w-4 shrink-0" />
            <span>{formatDuration(msRemaining)} remaining</span>
          </>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground/70">
        Due {new Date(dueDate).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  );
}
