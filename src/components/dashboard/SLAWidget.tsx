import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function SLAWidget({ complianceRate }: { complianceRate: number }) {
  const rate = Math.min(100, Math.max(0, complianceRate));

  const { color, bg, ring, label } =
    rate >= 90
      ? { color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500", ring: "ring-emerald-200 dark:ring-emerald-800", label: "Excellent" }
      : rate >= 70
        ? { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500", ring: "ring-amber-200 dark:ring-amber-800", label: "Needs attention" }
        : { color: "text-red-600 dark:text-red-400", bg: "bg-red-500", ring: "ring-red-200 dark:ring-red-800", label: "Critical" };

  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (rate / 100) * circumference;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4 text-primary" />
          SLA Compliance
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 py-4">
        {/* Circular progress */}
        <div className={cn("relative flex h-28 w-28 items-center justify-center rounded-full ring-4", ring)}>
          <svg className="-rotate-90" width="112" height="112" viewBox="0 0 80 80">
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              className="text-muted/40"
            />
            <circle
              cx="40"
              cy="40"
              r="36"
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={cn(
                "transition-all duration-700",
                rate >= 90 ? "stroke-emerald-500" : rate >= 70 ? "stroke-amber-500" : "stroke-red-500",
              )}
            />
          </svg>
          <div className="absolute text-center">
            <p className={cn("text-2xl font-bold leading-none", color)}>{rate}%</p>
          </div>
        </div>

        <div className="text-center">
          <p className={cn("text-sm font-semibold", color)}>{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Last 30 days</p>
        </div>
      </CardContent>
    </Card>
  );
}
