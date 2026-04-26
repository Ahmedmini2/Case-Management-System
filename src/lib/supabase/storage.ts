import { supabaseAdmin } from "@/lib/supabase/admin";

const ensuredBuckets = new Set<string>();

async function ensureBucket(bucket: string, isPublic = true): Promise<void> {
  if (ensuredBuckets.has(bucket)) return;
  const sb = supabaseAdmin();
  const { data: existing } = await sb.storage.getBucket(bucket);
  if (!existing) {
    const { error } = await sb.storage.createBucket(bucket, { public: isPublic });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`Failed to create bucket "${bucket}": ${error.message}`);
    }
  }
  ensuredBuckets.add(bucket);
}

export type UploadResult = {
  bucket: string;
  key: string;
  url: string;
};

export async function uploadToBucket(
  bucket: string,
  key: string,
  file: File | Blob | ArrayBuffer | Buffer,
  contentType: string,
): Promise<UploadResult> {
  await ensureBucket(bucket, true);
  const sb = supabaseAdmin();
  const body =
    file instanceof File || file instanceof Blob
      ? file
      : file instanceof ArrayBuffer
        ? new Blob([file], { type: contentType })
        : new Blob([new Uint8Array(file as Buffer)], { type: contentType });

  const { error: upErr } = await sb.storage
    .from(bucket)
    .upload(key, body, {
      contentType,
      upsert: false,
      cacheControl: "31536000",
    });

  if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

  const { data: pub } = sb.storage.from(bucket).getPublicUrl(key);
  return { bucket, key, url: pub.publicUrl };
}

export async function deleteFromBucket(bucket: string, key: string): Promise<void> {
  if (!key) return;
  const sb = supabaseAdmin();
  await sb.storage.from(bucket).remove([key]);
}

export async function signedUrl(bucket: string, key: string, expiresIn = 60 * 60): Promise<string | null> {
  const sb = supabaseAdmin();
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(key, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}

export const StorageBuckets = {
  Attachments: "case-attachments",
  Avatars: "avatars",
  WhatsAppMedia: "whatsapp-media",
} as const;
