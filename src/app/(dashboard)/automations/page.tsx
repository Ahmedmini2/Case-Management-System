import Link from "next/link";
import { AutomationBuilder } from "@/components/automations/AutomationBuilder";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

export default async function AutomationsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const items = await db.automation.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, isActive: true, runCount: true, lastRunAt: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Automations</h1>
        <Link href="/settings/automations" className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">
          Automation Settings
        </Link>
      </div>

      <AutomationBuilder />

      <div className="space-y-2">
        <h2 className="font-medium">Saved Automations</h2>
        {items.map((item) => (
          <Link key={item.id} href={`/automations/${item.id}`} className="block rounded-md border p-3 text-sm">
            <p className="font-medium">{item.name}</p>
            <p className="text-muted-foreground">
              {item.isActive ? "Active" : "Inactive"} - runs: {item.runCount}
            </p>
          </Link>
        ))}
        {!items.length ? <p className="text-sm text-muted-foreground">No automations yet.</p> : null}
      </div>
    </div>
  );
}
