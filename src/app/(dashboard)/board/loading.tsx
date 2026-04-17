import { Skeleton } from "@/components/ui/skeleton";

export default function BoardLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-8 w-36 rounded-md" />
      </div>
      <Skeleton className="h-9 w-64 rounded-lg" />
      {/* Columns */}
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-80 shrink-0 space-y-3">
            <Skeleton className="h-10 w-full rounded-xl" />
            {Array.from({ length: 4 - i }).map((_, j) => (
              <Skeleton key={j} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
