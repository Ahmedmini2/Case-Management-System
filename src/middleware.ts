import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const webhookHits = new Map<string, { count: number; windowStart: number }>();
const WEBHOOK_RATE_LIMIT = 100;
const WINDOW_MS = 60_000;

function checkWebhookRateLimit(ip: string) {
  const now = Date.now();
  const current = webhookHits.get(ip);

  if (!current || now - current.windowStart > WINDOW_MS) {
    webhookHits.set(ip, { count: 1, windowStart: now });
    return true;
  }

  if (current.count >= WEBHOOK_RATE_LIMIT) {
    return false;
  }

  current.count += 1;
  webhookHits.set(ip, current);
  return true;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api");
  const isAuthApi = pathname.startsWith("/api/auth");
  const isWebhookApi = pathname.startsWith("/api/webhooks");
  const isPortalApi = pathname.startsWith("/api/portal");
  const isWhatsAppWebhook = pathname.startsWith("/api/whatsapp/webhook") || pathname.startsWith("/api/whatsapp/ai-reply");
  const isPortalPath = pathname.startsWith("/portal");
  const isPublicPage = pathname === "/login" || pathname === "/register";

  if (isWebhookApi) {
    const ip = req.ip ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!checkWebhookRateLimit(ip)) {
      return NextResponse.json(
        { data: null, error: "Rate limit exceeded", meta: null },
        { status: 429 },
      );
    }
  }

  if (isApi && !isAuthApi && !isWebhookApi && !isPortalApi && !isWhatsAppWebhook && !isPortalPath && !req.auth) {
    return NextResponse.json({ data: null, error: "Unauthorized", meta: null }, { status: 401 });
  }

  if (!isApi && !isPortalPath && !isPublicPage && !req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
