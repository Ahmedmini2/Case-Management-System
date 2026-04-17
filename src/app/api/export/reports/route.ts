import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getReportsData } from "@/lib/reports";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const data = await getReportsData({ range: "30d" });

  const lines = [
    "metric,value",
    `totalCases,${data.totals.totalCases}`,
    `open,${data.totals.open}`,
    `inProgress,${data.totals.inProgress}`,
    `closed,${data.totals.closed}`,
    `slaComplianceRate,${data.slaComplianceRate}`,
  ];

  return new NextResponse(lines.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="reports-summary.csv"',
    },
  });
}
