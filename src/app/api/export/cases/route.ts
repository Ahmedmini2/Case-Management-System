import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const cases = await db.case.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      caseNumber: true,
      title: true,
      status: true,
      priority: true,
      source: true,
      createdAt: true,
      dueDate: true,
    },
    take: 2000,
  });

  const lines = [
    "caseNumber,title,status,priority,source,createdAt,dueDate",
    ...cases.map((c) =>
      [
        c.caseNumber,
        `"${c.title.replace(/"/g, '""')}"`,
        c.status,
        c.priority,
        c.source,
        c.createdAt.toISOString(),
        c.dueDate?.toISOString() ?? "",
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
