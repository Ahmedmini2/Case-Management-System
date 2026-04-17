import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const handledBy = searchParams.get("handledBy");
  const search = searchParams.get("search");
  const unreadOnly = searchParams.get("unreadOnly");

  const where: Record<string, unknown> = {};

  if (status) {
    where.status = status.toUpperCase();
  }
  if (handledBy) {
    where.handledBy = handledBy.toUpperCase();
  }
  if (unreadOnly === "true") {
    where.unreadCount = { gt: 0 };
  }
  if (search) {
    where.OR = [
      { contactName: { contains: search, mode: "insensitive" } },
      { contactPhone: { contains: search } },
      { lastMessage: { contains: search, mode: "insensitive" } },
    ];
  }

  const conversations = await db.whatsAppConversation.findMany({
    where,
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  });

  // Attach agent names
  const agentIds = [...new Set(conversations.map((c) => c.agentId).filter(Boolean))] as string[];
  const agentMap = new Map<string, string>();
  if (agentIds.length > 0) {
    const agents = await db.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true, email: true },
    });
    for (const a of agents) agentMap.set(a.id, a.name ?? a.email);
  }

  const enriched = conversations.map((c) => ({
    ...c,
    agentName: c.agentId ? agentMap.get(c.agentId) ?? null : null,
  }));

  return NextResponse.json(ok(enriched));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const body = (await request.json()) as {
    contactName: string;
    contactPhone: string;
    contactAvatar?: string;
  };

  if (!body.contactName || !body.contactPhone) {
    return NextResponse.json(fail("contactName and contactPhone are required"), { status: 400 });
  }

  const conversation = await db.whatsAppConversation.upsert({
    where: { contactPhone: body.contactPhone },
    update: { contactName: body.contactName },
    create: {
      contactName: body.contactName,
      contactPhone: body.contactPhone,
      contactAvatar: body.contactAvatar ?? null,
    },
  });

  return NextResponse.json(ok(conversation), { status: 201 });
}
