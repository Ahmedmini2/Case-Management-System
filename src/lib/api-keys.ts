import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "@/lib/prisma";

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
  const candidates = await db.apiKey.findMany({
    where: {
      prefix,
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true, keyHash: true, name: true },
  });

  for (const key of candidates) {
    const ok = await bcrypt.compare(rawKey, key.keyHash);
    if (ok) {
      await db.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      });
      return key;
    }
  }

  return null;
}
