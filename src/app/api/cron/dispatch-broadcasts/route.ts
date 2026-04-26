import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Vercel Cron pings this endpoint every minute. It picks up any broadcast whose
// scheduledAt has passed and is still SCHEDULED, then triggers the existing send route.
//
// Vercel signs cron requests with the CRON_SECRET env var via `Authorization: Bearer <secret>`.
// In dev, also accept ?secret=... query for manual triggering.

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // If no secret is configured, allow (dev convenience). Set CRON_SECRET in production.
  if (!secret) return true;

  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;

  const url = new URL(request.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}

async function dispatch() {
  const sb = supabaseAdmin();
  const nowIso = new Date().toISOString();

  // Find due, still-scheduled broadcasts
  const { data: dueRaw, error } = await sb
    .from("broadcasts")
    .select("id")
    .eq("status", "SCHEDULED")
    .not("scheduledAt", "is", null)
    .lte("scheduledAt", nowIso)
    .limit(20);

  if (error) {
    console.error("[cron/dispatch-broadcasts] lookup failed:", error.message);
    return { triggered: 0, errors: [error.message] };
  }

  const due = (dueRaw ?? []) as { id: string }[];
  if (due.length === 0) return { triggered: 0, errors: [] };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cronSecret = process.env.CRON_SECRET ?? "";

  const errors: string[] = [];
  let triggered = 0;

  for (const b of due) {
    try {
      // Hit the existing send endpoint with the cron secret so it bypasses session auth.
      // The send endpoint itself flips status SCHEDULED → SENDING and prevents double-fires.
      void fetch(`${baseUrl}/api/whatsapp/broadcasts/${b.id}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": cronSecret,
        },
      }).catch((e) => console.error(`[cron] send fetch failed for ${b.id}:`, e));

      triggered++;
    } catch (err) {
      errors.push(`${b.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { triggered, errors };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }
  const result = await dispatch();
  return NextResponse.json(ok(result));
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }
  const result = await dispatch();
  return NextResponse.json(ok(result));
}
