import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

// List all broadcasts
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const broadcasts = await db.broadcast.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      template: { select: { id: true, name: true, status: true } },
    },
  });

  return NextResponse.json(ok(broadcasts));
}

// Create a new broadcast (draft)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const body = (await request.json()) as {
    name?: string;
    templateId?: string;
    templateVars?: Record<string, string>;
    recipients?: { phone: string; contactName?: string }[];
  };

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const templateId = typeof body.templateId === "string" ? body.templateId : null;
  const templateVars = body.templateVars && typeof body.templateVars === "object" ? body.templateVars : null;
  const recipients = Array.isArray(body.recipients) ? body.recipients : [];

  if (!name) return NextResponse.json(fail("Broadcast name is required"), { status: 400 });
  if (!templateId) return NextResponse.json(fail("Please select a message template"), { status: 400 });
  if (recipients.length === 0) return NextResponse.json(fail("At least one recipient is required"), { status: 400 });

  // Verify template exists and is approved
  const template = await db.whatsAppTemplate.findUnique({ where: { id: templateId } });
  if (!template) return NextResponse.json(fail("Template not found"), { status: 404 });
  if (template.status !== "APPROVED") {
    return NextResponse.json(fail(`Template "${template.name}" is not approved yet (status: ${template.status}). Only approved templates can be used for broadcasts.`), { status: 400 });
  }

  // Build the preview message from template
  let previewMessage = template.body;
  if (templateVars) {
    for (const [key, value] of Object.entries(templateVars)) {
      previewMessage = previewMessage.replace(`{{${key}}}`, value);
    }
  }

  // Normalize and deduplicate phone numbers
  const seen = new Set<string>();
  const unique = recipients
    .map((r) => ({
      phone: (typeof r.phone === "string" ? r.phone : "").replace(/[^+\d]/g, ""),
      contactName: typeof r.contactName === "string" ? r.contactName.trim() : null,
    }))
    .filter((r) => {
      if (r.phone.length < 7) return false;
      if (!r.phone.startsWith("+")) r.phone = `+${r.phone}`;
      if (seen.has(r.phone)) return false;
      seen.add(r.phone);
      return true;
    });

  if (unique.length === 0) return NextResponse.json(fail("No valid phone numbers found"), { status: 400 });

  const broadcast = await db.broadcast.create({
    data: {
      name,
      message: previewMessage,
      templateId,
      templateVars: templateVars ?? undefined,
      status: "DRAFT",
      totalCount: unique.length,
      createdById: session.user.id,
      recipients: {
        create: unique.map((r) => ({
          phone: r.phone,
          contactName: r.contactName,
        })),
      },
    },
    select: {
      id: true,
      name: true,
      status: true,
      totalCount: true,
      createdAt: true,
    },
  });

  return NextResponse.json(ok(broadcast), { status: 201 });
}
