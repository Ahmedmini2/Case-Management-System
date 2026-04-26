import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { deleteFromBucket, StorageBuckets, uploadToBucket } from "@/lib/supabase/storage";

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
  "application/zip",
];
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("attachments")
    .select("id, fileName, fileSize, mimeType, url, createdAt")
    .eq("caseId", id)
    .order("createdAt", { ascending: false });

  if (error) return NextResponse.json(fail(error.message), { status: 500 });

  const attachments = data ?? [];
  return NextResponse.json(ok(attachments, { total: attachments.length }));
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data: caseRecord, error: caseErr } = await sb
    .from("cases")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (caseErr) return NextResponse.json(fail(caseErr.message), { status: 500 });
  if (!caseRecord) return NextResponse.json(fail("Case not found"), { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json(fail("No file provided"), { status: 400 });

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(fail("File type not allowed"), { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(fail("File exceeds 25 MB limit"), { status: 400 });
  }

  const ext = file.name.split(".").pop() ?? "bin";
  const key = `${id}/${randomUUID()}.${ext}`;

  let uploaded;
  try {
    uploaded = await uploadToBucket(StorageBuckets.Attachments, key, file, file.type);
  } catch (err) {
    return NextResponse.json(
      fail(err instanceof Error ? err.message : "Upload failed"),
      { status: 500 },
    );
  }

  const { data: attachment, error: insertErr } = await sb
    .from("attachments")
    .insert({
      caseId: id,
      uploadedById: session.user.id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      url: uploaded.url,
      key: uploaded.key,
    })
    .select("id, fileName, fileSize, mimeType, url, createdAt")
    .single();

  if (insertErr) {
    // best-effort rollback of the storage object
    await deleteFromBucket(StorageBuckets.Attachments, uploaded.key).catch(() => {});
    return NextResponse.json(fail(insertErr.message), { status: 500 });
  }

  const { error: actErr } = await sb.from("activities").insert({
    caseId: id,
    userId: session.user.id,
    type: "ATTACHMENT_ADDED",
    description: `Attached file: ${file.name}`,
    newValue: file.name,
  });
  if (actErr) console.error("[attachments:create] best-effort activity failed:", actErr.message);

  return NextResponse.json(ok(attachment), { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const { searchParams } = new URL(request.url);
  const attachmentId = searchParams.get("attachmentId");
  if (!attachmentId) return NextResponse.json(fail("attachmentId required"), { status: 400 });

  const sb = supabaseAdmin();
  const { data: attachment, error: findErr } = await sb
    .from("attachments")
    .select("id, key")
    .eq("id", attachmentId)
    .eq("caseId", id)
    .maybeSingle();
  if (findErr) return NextResponse.json(fail(findErr.message), { status: 500 });
  if (!attachment) return NextResponse.json(fail("Attachment not found"), { status: 404 });

  const att = attachment as { id: string; key: string | null };

  const { error: delErr } = await sb.from("attachments").delete().eq("id", attachmentId);
  if (delErr) return NextResponse.json(fail(delErr.message), { status: 500 });

  if (att.key) {
    await deleteFromBucket(StorageBuckets.Attachments, att.key).catch((e) => {
      console.error("[attachments:delete] storage cleanup failed:", e);
    });
  }

  return NextResponse.json(ok({ id: attachmentId }));
}
