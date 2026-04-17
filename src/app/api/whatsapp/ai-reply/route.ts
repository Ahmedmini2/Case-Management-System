import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";
import { triggerPusherEvent } from "@/lib/pusher";

// Called by the AI agent (n8n) to send a reply through our system
// This saves the message to DB AND sends it via WhatsApp API
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      conversationId?: string;
      contactPhone?: string;
      body?: string;
      senderName?: string;
    };

    const messageBody = typeof body.body === "string" ? body.body.trim() : "";
    if (!messageBody) {
      return NextResponse.json({ error: "Message body is required" }, { status: 400 });
    }

    // Find conversation by ID or phone number
    let conversation;
    if (body.conversationId) {
      conversation = await db.whatsAppConversation.findUnique({
        where: { id: body.conversationId },
      });
    } else if (body.contactPhone) {
      conversation = await db.whatsAppConversation.findUnique({
        where: { contactPhone: body.contactPhone },
      });
    }

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Block AI replies if a human has taken over
    if (conversation.handledBy === "HUMAN") {
      return NextResponse.json(
        { error: "Conversation is handled by a human agent. AI reply blocked.", blocked: true },
        { status: 403 },
      );
    }

    // Send via WhatsApp Business API
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_TOKEN;
    let waMessageId: string | null = null;

    if (phoneNumberId && token) {
      try {
        const waRes = await fetch(
          `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: conversation.contactPhone,
              type: "text",
              text: { body: messageBody },
            }),
          },
        );

        if (waRes.ok) {
          const waData = (await waRes.json()) as { messages?: { id: string }[] };
          waMessageId = waData.messages?.[0]?.id ?? null;
        } else {
          const errText = await waRes.text();
          console.error("[AI Reply] WhatsApp API error:", errText);
        }
      } catch (err) {
        console.error("[AI Reply] WhatsApp API network error:", err);
      }
    }

    // Save AI reply to DB
    const message = await db.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        whatsappMsgId: waMessageId,
        direction: "outbound",
        sender: "ai",
        senderName: body.senderName ?? "Dungeon AI",
        body: messageBody,
        isAI: true,
        status: waMessageId ? "sent" : "failed",
        isRead: true,
      },
    });

    // Update conversation last message
    await db.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessage: messageBody.length > 200 ? messageBody.slice(0, 200) + "..." : messageBody,
        lastMessageAt: new Date(),
      },
    });

    // Push real-time update
    await triggerPusherEvent(
      `conversation-${conversation.id}`,
      "whatsapp:new_message",
      { conversationId: conversation.id, messageId: message.id },
    );
    await triggerPusherEvent("whatsapp", "whatsapp:conversation_updated", {
      conversationId: conversation.id,
    });

    return NextResponse.json({
      success: true,
      messageId: message.id,
      whatsappMessageId: waMessageId,
    });
  } catch (err) {
    console.error("[AI Reply] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
