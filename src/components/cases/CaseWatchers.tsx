"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Watcher = {
  userId: string;
  createdAt: string;
  user: { id: string; name: string | null; email: string | null; image: string | null } | null;
};

export function CaseWatchers({ caseId, currentUserId }: { caseId: string; currentUserId: string }) {
  const [watchers, setWatchers] = useState<Watcher[]>([]);
  const [loading, setLoading] = useState(false);

  const isWatching = watchers.some((w) => w.userId === currentUserId);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/cases/${caseId}/watchers`);
      const json = (await res.json()) as { data: Watcher[] | null };
      setWatchers(json.data ?? []);
    }
    void load();
  }, [caseId]);

  async function toggleWatch() {
    setLoading(true);
    const res = await fetch(`/api/cases/${caseId}/watchers`, {
      method: isWatching ? "DELETE" : "POST",
    });
    setLoading(false);
    if (!res.ok) { toast.error("Failed to update watch status"); return; }

    if (isWatching) {
      setWatchers((prev) => prev.filter((w) => w.userId !== currentUserId));
      toast.success("Stopped watching this case");
    } else {
      // Refresh to get full user info
      const listRes = await fetch(`/api/cases/${caseId}/watchers`);
      const json = (await listRes.json()) as { data: Watcher[] | null };
      setWatchers(json.data ?? []);
      toast.success("Now watching this case");
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Watchers ({watchers.length})
        </p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              disabled={loading}
              onClick={() => void toggleWatch()}
            >
              {isWatching ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isWatching ? "Stop watching" : "Watch this case"}</TooltipContent>
        </Tooltip>
      </div>

      {watchers.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {watchers.map((w) => {
            const name = w.user?.name ?? w.user?.email ?? "Unknown";
            const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
            return (
              <Tooltip key={w.userId}>
                <TooltipTrigger asChild>
                  <Avatar className="h-6 w-6 ring-2 ring-background">
                    <AvatarImage src={w.user?.image ?? undefined} alt={name} />
                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>{name}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground/60 italic">No watchers yet</p>
      )}
    </div>
  );
}
