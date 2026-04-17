import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { runAutomationEngine } from "@/lib/automations/engine";

const schema = z.object({
  caseId: z.string(),
  triggerType: z.string(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json(fail("Invalid request body"), { status: 400 });

  const result = await runAutomationEngine({
    caseId: parsed.data.caseId,
    triggerType: parsed.data.triggerType as never,
    actorUserId: session.user.id,
  });
  return NextResponse.json(ok(result));
}
