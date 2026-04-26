import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { ok, fail } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { StorageBuckets, uploadToBucket } from "@/lib/supabase/storage";

const MAX_SIZE = 64 * 1024 * 1024; // WhatsApp limit ~100MB but we cap conservatively
const ALLOWED = new Set([
  // Images
  "image/jpeg", "image/png", "image/webp",
  // Video
  "video/mp4", "video/3gpp",
  // Audio
  "audio/aac", "audio/mp4", "audio/mpeg", "audio/amr", "audio/ogg",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv",
]);

function bucketFor(mime: string): "image" | "video" | "audio" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data: convRow, error: convErr } = await sb
    .from("whatsapp_conversations")
    .select("id, contactPhone")
    .eq("id", id)
    .maybeSingle();
  if (convErr) return NextResponse.json(fail(convErr.message), { status: 500 });
  if (!convRow) return NextResponse.json(fail("Conversation not found"), { status: 404 });
  const conv = convRow as { id: string; contactPhone: string };

  const formData = await request.formData();
  const file = formData.get("file");
  const caption = (formData.get("caption") as string | null) ?? "";
  if (!(file instanceof File)) return NextResponse.json(fail("file is required"), { status: 400 });
  if (!ALLOWED.has(file.type)) return NextResponse.json(fail(`File type not allowed: ${file.type}`), { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json(fail("File exceeds 64 MB limit"), { status: 400 });

  // Upload to Supabase Storage
  const ext = file.name.split(".").pop() ?? "bin";
  const key = `${id}/${randomUUID()}.${ext}`;
  let publicUrl: string;
  try {
    const uploaded = await uploadToBucket(StorageBuckets.WhatsAppMedia, key, file, file.type);
    publicUrl = uploaded.url;
  } catch (err) {
    return NextResponse.json(
      fail(err instanceof Error ? err.message : "Upload failed"),
      { status: 500 },
    );
  }

  // Send via Meta Graph API
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  if (!phoneNumberId || !token) {
    return NextResponse.json(fail("WhatsApp credentials not configured"), { status: 500 });
  }

  const kind = bucketFor(file.type);
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    to: conv.contactPhone,
    type: kind,
  };
  if (kind === "document") {
    payload.document = { link: publicUrl, filename: file.name, ...(caption ? { caption } : {}) };
  } else if (kind === "image") {
    payload.image = { link: publicUrl, ...(caption ? { caption } : {}) };
  } else if (kind === "video") {
    payload.video = { link: publicUrl, ...(caption ? { caption } : {}) };
  } else {
    payload.audio = { link: publicUrl };
  }

  let waMsgId: string | null = null;
  try {
    const waRes = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!waRes.ok) {
      const errText = await waRes.text();
      return NextResponse.json(fail(`WhatsApp API error: ${errText.slice(0, 300)}`), { status: 502 });
    }
    const data = (await waRes.json()) as { messages?: { id: string }[] };
    waMsgId = data.messages?.[0]?.id ?? null;
  } catch (err) {
    return NextResponse.json(fail(err instanceof Error ? err.message : "Send failed"), { status: 502 });
  }

  // Resolve sender display name
  const { data: user } = await sb
    .from("users")
    .select("name, email")
    .eq("id", session.user.id)
    .maybeSingle();
  const senderName =
    (user as { name?: string | null; email?: string } | null)?.name ??
    (user as { email?: string } | null)?.email ??
    "Agent";

  // Persist outbound message
  const { data: message, error: insErr } = await sb
    .from("whatsapp_messages")
    .insert({
      conversationId: id,
      whatsappMsgId: waMsgId,
      direction: "outbound",
      sender: "agent",
      senderName,
      body: caption || file.name,
      mediaUrl: publicUrl,
      mediaType: kind,
      isAI: false,
      status: "sent",
      isRead: true,
    })
    .select("*")
    .single();
  if (insErr) return NextResponse.json(fail(insErr.message), { status: 500 });

  // Update conversation last-message
  const lastMessage = caption || `[${kind}] ${file.name}`;
  await sb
    .from("whatsapp_conversations")
    .update({
      lastMessage: lastMessage.length > 200 ? lastMessage.slice(0, 200) + "..." : lastMessage,
      lastMessageAt: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json(ok(message), { status: 201 });
}
