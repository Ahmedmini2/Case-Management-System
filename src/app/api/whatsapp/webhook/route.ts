import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { triggerPusherEvent } from "@/lib/pusher";

// WhatsApp webhook verification
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? "", { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

// Receive incoming WhatsApp messages
export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;

    // WhatsApp sends nested: entry[0].changes[0].value
    const entries = Array.isArray(payload.entry) ? payload.entry : [];
    for (const entry of entries) {
      const changes = Array.isArray((entry as Record<string, unknown>).changes)
        ? ((entry as Record<string, unknown>).changes as Record<string, unknown>[])
        : [];

      for (const change of changes) {
        const value = change.value as Record<string, unknown> | undefined;
        if (!value) continue;

        const messages = Array.isArray(value.messages) ? value.messages : [];
        const contacts = Array.isArray(value.contacts) ? value.contacts : [];
        const statuses = Array.isArray(value.statuses) ? value.statuses : [];

        // ---- Process delivery/read status updates ----
        for (const status of statuses as Record<string, unknown>[]) {
          const waMsgId = typeof status.id === "string" ? status.id : null;
          const statusValue = typeof status.status === "string" ? status.status : "";
          const recipientId = typeof status.recipient_id === "string" ? status.recipient_id : null;

          if (!waMsgId || !statusValue) continue;

          // Map WhatsApp status to our status values
          let mappedStatus: string | null = null;
          if (statusValue === "delivered") mappedStatus = "delivered";
          else if (statusValue === "read") mappedStatus = "read";
          else if (statusValue === "failed") mappedStatus = "failed";
          else continue; // skip "sent" as we already track that

          // Update WhatsAppMessage in conversation
          try {
            await db.whatsAppMessage.updateMany({
              where: { whatsappMsgId: waMsgId },
              data: { status: mappedStatus },
            });
          } catch { /* message might not exist locally */ }

          // Update BroadcastRecipient for broadcast tracking
          try {
            const recipient = await db.broadcastRecipient.findFirst({
              where: { whatsappMsgId: waMsgId },
              select: { id: true, broadcastId: true, status: true },
            });

            if (recipient) {
              const now = new Date();
              const updateData: Record<string, unknown> = {};

              if (mappedStatus === "delivered" && recipient.status !== "READ") {
                updateData.status = "DELIVERED";
                updateData.deliveredAt = now;
              } else if (mappedStatus === "read") {
                updateData.status = "READ";
                updateData.readAt = now;
                if (!recipient.status || recipient.status === "SENT" || recipient.status === "PENDING") {
                  updateData.deliveredAt = now;
                }
              } else if (mappedStatus === "failed") {
                const errors = (status.errors ?? []) as Record<string, unknown>[];
                const errMsg = errors[0] ? String((errors[0] as Record<string, unknown>).title ?? "Unknown error") : "Delivery failed";
                updateData.status = "FAILED";
                updateData.error = errMsg;
              }

              if (Object.keys(updateData).length > 0) {
                await db.broadcastRecipient.update({
                  where: { id: recipient.id },
                  data: updateData,
                });

                // Recalculate broadcast aggregate counts
                const counts = await db.broadcastRecipient.groupBy({
                  by: ["status"],
                  where: { broadcastId: recipient.broadcastId },
                  _count: true,
                });

                const countMap = new Map(counts.map((c) => [c.status, c._count]));
                await db.broadcast.update({
                  where: { id: recipient.broadcastId },
                  data: {
                    deliveredCount: (countMap.get("DELIVERED") ?? 0) + (countMap.get("READ") ?? 0),
                    readCount: countMap.get("READ") ?? 0,
                    failedCount: countMap.get("FAILED") ?? 0,
                  },
                });
              }
            }
          } catch (err) {
            console.error("[WhatsApp Webhook] Status update error:", err);
          }
        }

        // ---- Process incoming messages ----
        for (const msg of messages as Record<string, unknown>[]) {
          const from = typeof msg.from === "string" ? msg.from : "";
          const msgId = typeof msg.id === "string" ? msg.id : null;
          const msgType = typeof msg.type === "string" ? msg.type : "text";
          const timestamp = typeof msg.timestamp === "string"
            ? new Date(parseInt(msg.timestamp, 10) * 1000)
            : new Date();

          let body = "";
          let mediaUrl: string | null = null;
          let mediaType: string | null = null;

          if (msgType === "text") {
            const text = msg.text as Record<string, unknown> | undefined;
            body = typeof text?.body === "string" ? text.body : "";
          } else if (["image", "video", "audio", "document"].includes(msgType)) {
            mediaType = msgType;
            const mediaObj = msg[msgType] as Record<string, unknown> | undefined;
            body = typeof mediaObj?.caption === "string" ? mediaObj.caption : `[${msgType}]`;
            mediaUrl = typeof mediaObj?.id === "string" ? mediaObj.id : null;
          }

          if (!from) continue;

          // Get contact name from webhook payload
          const contactEntry = (contacts as Record<string, unknown>[]).find(
            (c) => (c.wa_id as string) === from,
          );
          const profile = contactEntry?.profile as Record<string, unknown> | undefined;
          const contactName = typeof profile?.name === "string" ? profile.name : from;

          // Find or create conversation
          const conversation = await db.whatsAppConversation.upsert({
            where: { contactPhone: from },
            update: {
              contactName,
              lastMessage: body.length > 200 ? body.slice(0, 200) + "..." : body,
              lastMessageAt: timestamp,
              unreadCount: { increment: 1 },
            },
            create: {
              contactName,
              contactPhone: from,
              lastMessage: body.length > 200 ? body.slice(0, 200) + "..." : body,
              lastMessageAt: timestamp,
              unreadCount: 1,
            },
          });

          // Save inbound message
          await db.whatsAppMessage.create({
            data: {
              conversationId: conversation.id,
              whatsappMsgId: msgId,
              direction: "inbound",
              sender: "customer",
              senderName: contactName,
              body,
              mediaUrl,
              mediaType,
              isAI: false,
              status: "delivered",
              timestamp,
            },
          });

          // If AI is handling, forward to AI agent webhook
          if (conversation.handledBy === "AI" && process.env.AI_AGENT_WEBHOOK_URL) {
            fetch(process.env.AI_AGENT_WEBHOOK_URL, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                conversationId: conversation.id,
                contactPhone: from,
                contactName,
                messageId: msgId,
                body,
                mediaUrl,
                mediaType,
                handledBy: conversation.handledBy,
                timestamp: timestamp.toISOString(),
              }),
            }).catch((err) =>
              console.error("[WhatsApp Webhook] AI forward error:", err),
            );
          }

          // If human-handled, push real-time update
          if (conversation.handledBy === "HUMAN") {
            await triggerPusherEvent(
              `conversation-${conversation.id}`,
              "whatsapp:new_message",
              {
                conversationId: conversation.id,
                messageId: msgId,
                from,
                body,
                timestamp: timestamp.toISOString(),
              },
            );
          }

          // Create notification for all active agents
          const agents = await db.user.findMany({
            where: { role: { in: ["ADMIN", "SUPER_ADMIN", "MANAGER", "AGENT"] }, isActive: true },
            select: { id: true },
          });
          if (agents.length > 0) {
            await db.notification.createMany({
              data: agents.map((a) => ({
                userId: a.id,
                type: "WHATSAPP",
                title: `WhatsApp: ${contactName}`,
                body: body.length > 100 ? body.slice(0, 100) + "..." : body,
                link: "/whatsapp",
              })),
            });
          }

          // Also update conversation list for all agents
          await triggerPusherEvent("whatsapp", "whatsapp:conversation_updated", {
            conversationId: conversation.id,
          });
        }
      }
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    console.error("[WhatsApp Webhook] Error:", err);
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
}
