import Link from "next/link";

export default function AutomationSettingsPage() {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold">Automation Settings</h1>
      <p className="text-sm text-muted-foreground">
        Manage automation defaults and dry-run behavior. Builder is available in Automations.
      </p>
      <Link href="/automations" className="text-sm underline">
        Open automation builder
      </Link>
    </div>
  );
}
