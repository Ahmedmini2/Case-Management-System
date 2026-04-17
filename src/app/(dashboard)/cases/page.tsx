import Link from "next/link";
import { CaseListClient } from "@/components/cases/CaseListClient";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { Download, Plus, LayoutList } from "lucide-react";

async function getCases() {
  return db.case.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      caseNumber: true,
      title: true,
      status: true,
      priority: true,
      source: true,
      createdAt: true,
      dueDate: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      tags: {
        select: {
          tag: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });
}

export default async function CasesPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const cases = await getCases();

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <LayoutList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Cases</h1>
            <p className="text-xs text-muted-foreground">{cases.length} cases · sorted by newest</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/api/export/cases"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Link>
          <Link
            href="/cases/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Case
          </Link>
        </div>
      </div>

      <CaseListClient
        items={cases.map((item) => ({
          ...item,
          createdAt: new Date(item.createdAt).toISOString(),
          dueDate: item.dueDate ? new Date(item.dueDate).toISOString() : null,
          tags: item.tags.map((t) => t.tag),
        }))}
      />
    </div>
  );
}
