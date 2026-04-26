import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("cases")
    .select("caseNumber, title, status, priority, source, createdAt, dueDate")
    .order("createdAt", { ascending: false })
    .limit(2000);

  if (error) return NextResponse.json(fail(error.message), { status: 500 });

  type CaseRow = {
    caseNumber: string;
    title: string;
    status: string;
    priority: string;
    source: string;
    createdAt: string;
    dueDate: string | null;
  };
  const cases = ((data as CaseRow[] | null) ?? []);

  const lines = [
    "caseNumber,title,status,priority,source,createdAt,dueDate",
    ...cases.map((c) =>
      [
        c.caseNumber,
        `"${c.title.replace(/"/g, '""')}"`,
        c.status,
        c.priority,
        c.source,
        c.createdAt ? new Date(c.createdAt).toISOString() : "",
        c.dueDate ? new Date(c.dueDate).toISOString() : "",
      ].join(","),
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cases.csv"',
    },
  });
}
