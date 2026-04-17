import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

type AgentRow = {
  agentId: string;
  agentName: string;
  assignedCount: number;
  resolvedCount: number;
  avgResolutionHours: number;
};

function AgentAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const colors = [
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${color}`}>
      {initials}
    </span>
  );
}

function ResolutionBar({ resolved, assigned }: { resolved: number; assigned: number }) {
  const pct = assigned === 0 ? 0 : Math.round((resolved / assigned) * 100);
  const color =
    pct >= 75
      ? "bg-emerald-500"
      : pct >= 50
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

export function AgentPerformance({ rows }: { rows: AgentRow[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4 text-primary" />
          Agent Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="pb-2 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Agent
                </th>
                <th className="pb-2 pr-4 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Assigned
                </th>
                <th className="pb-2 pr-4 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Resolved
                </th>
                <th className="pb-2 pr-4 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Resolution rate
                </th>
                <th className="pb-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Avg (hrs)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((row) => (
                <tr key={row.agentId} className="group hover:bg-accent/30 transition-colors">
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2.5">
                      <AgentAvatar name={row.agentName} />
                      <span className="font-medium">{row.agentName}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{row.assignedCount}</td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">{row.resolvedCount}</td>
                  <td className="py-2.5 pr-4">
                    <ResolutionBar resolved={row.resolvedCount} assigned={row.assignedCount} />
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-muted-foreground">
                    {row.avgResolutionHours}h
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    No performance data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
