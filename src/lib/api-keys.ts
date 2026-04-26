import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type ApiKeyScope = "read-only" | "write" | "admin";

export function generateApiKey() {
  return `cms_live_${nanoid(32)}`;
}

export async function hashApiKey(rawKey: string) {
  return bcrypt.hash(rawKey, 12);
}

export function getApiKeyPrefix(rawKey: string) {
  return rawKey.slice(0, 8);
}

export async function verifyApiKey(rawKey: string) {
  if (!rawKey.startsWith("cms_live_")) return null;

  const prefix = getApiKeyPrefix(rawKey);
  const sb = supabaseAdmin();
  const nowIso = new Date().toISOString();
  const { data: candidatesRaw, error } = await sb
    .from("api_keys")
    .select("id, keyHash, name, expiresAt")
    .eq("prefix", prefix)
    .eq("isActive", true)
    .or(`expiresAt.is.null,expiresAt.gt.${nowIso}`);
  if (error) {
    console.error("[api-keys] lookup failed:", error.message);
    return null;
  }

  const candidates = (candidatesRaw ?? []) as {
    id: string;
    keyHash: string;
    name: string;
    expiresAt: string | null;
  }[];

  for (const key of candidates) {
    const ok = await bcrypt.compare(rawKey, key.keyHash);
    if (ok) {
      await sb
        .from("api_keys")
        .update({ lastUsedAt: nowIso })
        .eq("id", key.id);
      return { id: key.id, keyHash: key.keyHash, name: key.name };
    }
  }

  return null;
}
