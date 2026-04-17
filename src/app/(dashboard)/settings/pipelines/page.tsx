import Link from "next/link";

export default function PipelinesSettingsPage() {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">Pipelines</h2>
      <p className="text-sm text-muted-foreground">Manage pipeline definitions, stages, and default pipeline.</p>
      <Link href="/pipeline/new" className="text-sm underline">
        Create or edit pipelines
      </Link>
    </div>
  );
}
