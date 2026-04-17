import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { runSlaCheck } from "@/lib/sla";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });
  const result = await runSlaCheck();
  return NextResponse.json(ok(result));
}
