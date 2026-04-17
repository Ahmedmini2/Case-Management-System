import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getReportsData } from "@/lib/reports";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range");
  const teamId = searchParams.get("teamId");
  const agentId = searchParams.get("agentId");

  const data = await getReportsData({ range, teamId, agentId });
  return NextResponse.json(ok(data));
}
