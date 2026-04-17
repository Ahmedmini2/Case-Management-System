import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

const GRAPH_URL = "https://graph.facebook.com/v19.0";

// List all templates (local DB)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const templates = await db.whatsAppTemplate.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(ok(templates));
}

// Create a new template via Meta API + save locally
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const body = (await request.json()) as {
    name?: string;
    category?: string;
    language?: string;
    body?: string;
    header?: string;
    footer?: string;
  };

  const name = typeof body.name === "string" ? body.name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") : "";
  const category = typeof body.category === "string" ? body.category.toUpperCase() : "MARKETING";
  const language = typeof body.language === "string" ? body.language : "en";
  const templateBody = typeof body.body === "string" ? body.body.trim() : "";
  const header = typeof body.header === "string" ? body.header.trim() : null;
  const footer = typeof body.footer === "string" ? body.footer.trim() : null;

  if (!name) return NextResponse.json(fail("Template name is required"), { status: 400 });
  if (!templateBody) return NextResponse.json(fail("Template body is required"), { status: 400 });

  // Count variables in body: {{1}}, {{2}}, etc.
  const varMatches = templateBody.match(/\{\{\d+\}\}/g) ?? [];
  const variableCount = new Set(varMatches).size;

  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!wabaId || !token) {
    return NextResponse.json(fail("WhatsApp Business Account ID not configured. Add WHATSAPP_BUSINESS_ACCOUNT_ID to .env.local"), { status: 500 });
  }

  // Build Meta API payload
  const components: Record<string, unknown>[] = [];

  if (header) {
    components.push({ type: "HEADER", format: "TEXT", text: header });
  }

  components.push({
    type: "BODY",
    text: templateBody,
    ...(variableCount > 0 ? {
      example: {
        body_text: [Array.from({ length: variableCount }, (_, i) => `sample${i + 1}`)],
      },
    } : {}),
  });

  if (footer) {
    components.push({ type: "FOOTER", text: footer });
  }

  try {
    const metaRes = await fetch(`${GRAPH_URL}/${wabaId}/message_templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        language,
        category,
        components,
      }),
    });

    const metaData = (await metaRes.json()) as { id?: string; error?: { message?: string } };

    if (!metaRes.ok) {
      return NextResponse.json(
        fail(metaData.error?.message ?? "Meta API rejected the template"),
        { status: 400 },
      );
    }

    // Save locally
    const template = await db.whatsAppTemplate.create({
      data: {
        metaId: metaData.id ?? null,
        name,
        language,
        category,
        status: "PENDING",
        body: templateBody,
        header,
        footer,
        variableCount,
      },
    });

    return NextResponse.json(ok(template), { status: 201 });
  } catch (err) {
    console.error("[WhatsApp Templates] Create error:", err);
    return NextResponse.json(fail("Failed to create template"), { status: 500 });
  }
}
