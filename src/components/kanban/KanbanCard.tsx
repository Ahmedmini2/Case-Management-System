import { Priority } from "@/types/enums";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, UserCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const priorityConfig: Record<Priority, { border: string; dot: string; label: string }> = {
  CRITICAL: { border: "border-l-red-500", dot: "bg-red-500", label: "Critical" },
  HIGH: { border: "border-l-orange-500", dot: "bg-orange-500", label: "High" },
  MEDIUM: { border: "border-l-blue-500", dot: "bg-blue-500", label: "Medium" },
  LOW: { border: "border-l-slate-400", dot: "bg-slate-400", label: "Low" },
};

type BoardCase = {
  id: string;
  caseNumber: string;
  title: string;
  priority: Priority;
  dueDate: string | null;
  assignedTo: { id: string; name: string | null; image?: string | null } | null;
};

export function KanbanCard({ item }: { item: BoardCase }) {
  const cfg = priorityConfig[item.priority];
  const initials =
    item.assignedTo?.name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "U";

  return (
    <Card
      className={cn(
        "group border-l-[3px] bg-card shadow-sm transition-all duration-150 hover:shadow-md hover:-translate-y-px",
        cfg.border,
      )}
    >
      <CardContent className="space-y-2.5 px-3.5 py-3">
        {/* Top row */}
        <div className="flex items-center justify-between gap-2">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
            {item.caseNumber}
          </span>
          <Link
            href={`/cases/${item.id}`}
            aria-label="Open case details"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-primary/10 hover:text-primary"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Title */}
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{item.title}</p>

        {/* Priority chip */}
        <div className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
          <span className="text-[11px] text-muted-foreground">{cfg.label}</span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarImage src={item.assignedTo?.image ?? undefined} alt={item.assignedTo?.name ?? ""} />
              <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                {item.assignedTo ? initials : <UserCircle2 className="h-3 w-3" />}
              </AvatarFallback>
            </Avatar>
            <span className="truncate max-w-24">
              {item.assignedTo?.name ?? "Unassigned"}
            </span>
          </span>
          {item.dueDate && (
            <span className="flex items-center gap-1 shrink-0">
              <CalendarDays className="h-3 w-3" />
              {new Date(item.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
