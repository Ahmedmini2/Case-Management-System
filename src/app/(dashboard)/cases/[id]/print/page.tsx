import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function PrintCasePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const { id } = await params;
  const sb = supabaseAdmin();

  const { data: caseRow } = await sb
    .from("cases")
    .select("id, caseNumber, title, description, status, priority, source, createdAt, updatedAt")
    .eq("id", id)
    .maybeSingle();

  if (!caseRow) notFound();

  const item = caseRow as {
    id: string;
    caseNumber: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    source: string;
    createdAt: string;
    updatedAt: string;
  };

  const { data: commentsRaw } = await sb
    .from("comments")
    .select("id, body, createdAt")
    .eq("caseId", id)
    .eq("isInternal", false)
    .order("createdAt", { ascending: true });

  const comments = (commentsRaw ?? []) as { id: string; body: string; createdAt: string }[];

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6 print:p-0">
      <h1 className="text-2xl font-semibold">
        {item.caseNumber} - {item.title}
      </h1>
      <p>
        Status: {item.status} | Priority: {item.priority} | Source: {item.source}
      </p>
      <p>{item.description}</p>
      <h2 className="text-lg font-medium">Public Comments</h2>
      {comments.map((c) => (
        <div key={c.id} className="rounded-md border p-3">
          <p>{c.body}</p>
          <p className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</p>
        </div>
      ))}
      <p className="text-sm text-muted-foreground print:hidden">
        Use browser print (<kbd>Ctrl/Cmd + P</kbd>) to export this page as PDF.
      </p>
    </div>
  );
}
