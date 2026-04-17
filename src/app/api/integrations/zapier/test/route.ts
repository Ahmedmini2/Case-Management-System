import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const payload = {
    title: "Zapier test case",
    description: "This case was created from the Integrations test button.",
    priority: "MEDIUM",
    type: "Integration Test",
    source: "ZAPIER",
    tags: ["zapier", "test"],
  };
  const raw = JSON.stringify(payload);
  const secret = process.env.WEBHOOK_SECRET ?? "";
  const signature = crypto.createHmac("sha256", secret).update(raw).digest("hex");

  const response = await fetch(`${appUrl}/api/webhooks/zapier`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-secret": signature,
    },
    body: raw,
  });

  if (!response.ok) {
    return NextResponse.json(fail("Failed to send test webhook"), { status: 500 });
  }

  const result = await response.json();
  return NextResponse.json(ok(result.data ?? result));
}
