import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

const GRAPH_URL = "https://graph.facebook.com/v19.0";

type MetaTemplate = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: {
    type: string;
    text?: string;
    format?: string;
  }[];
};

function mapStatus(metaStatus: string): "PENDING" | "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED" {
  switch (metaStatus) {
    case "APPROVED": return "APPROVED";
    case "REJECTED": return "REJECTED";
    case "PAUSED": return "PAUSED";
    case "DISABLED": return "DISABLED";
    default: return "PENDING";
  }
}

// Sync templates from Meta Business API to local DB
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const token = process.env.WHATSAPP_TOKEN;

  if (!wabaId || !token) {
    return NextResponse.json(fail("WHATSAPP_BUSINESS_ACCOUNT_ID not configured"), { status: 500 });
  }

  try {
    const metaRes = await fetch(
      `${GRAPH_URL}/${wabaId}/message_templates?limit=100`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!metaRes.ok) {
      const errData = (await metaRes.json()) as { error?: { message?: string } };
      return NextResponse.json(fail(errData.error?.message ?? "Failed to fetch templates from Meta"), { status: 400 });
    }

    const metaData = (await metaRes.json()) as { data: MetaTemplate[] };
    const templates = metaData.data ?? [];

    let created = 0;
    let updated = 0;

    for (const t of templates) {
      const bodyComp = t.components.find((c) => c.type === "BODY");
      const headerComp = t.components.find((c) => c.type === "HEADER");
      const footerComp = t.components.find((c) => c.type === "FOOTER");
      const body = bodyComp?.text ?? "";

      const varMatches = body.match(/\{\{\d+\}\}/g) ?? [];
      const variableCount = new Set(varMatches).size;

      const existing = await db.whatsAppTemplate.findFirst({
        where: { OR: [{ metaId: t.id }, { name: t.name }] },
      });

      if (existing) {
        await db.whatsAppTemplate.update({
          where: { id: existing.id },
          data: {
            metaId: t.id,
            name: t.name,
            language: t.language,
            category: t.category,
            status: mapStatus(t.status),
            body,
            header: headerComp?.text ?? null,
            footer: footerComp?.text ?? null,
            variableCount,
          },
        });
        updated++;
      } else {
        await db.whatsAppTemplate.create({
          data: {
            metaId: t.id,
            name: t.name,
            language: t.language,
            category: t.category,
            status: mapStatus(t.status),
            body,
            header: headerComp?.text ?? null,
            footer: footerComp?.text ?? null,
            variableCount,
          },
        });
        created++;
      }
    }

    return NextResponse.json(ok({ synced: templates.length, created, updated }));
  } catch (err) {
    console.error("[WhatsApp Templates Sync] Error:", err);
    return NextResponse.json(fail("Failed to sync templates"), { status: 500 });
  }
}
