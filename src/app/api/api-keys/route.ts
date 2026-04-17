import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { generateApiKey, getApiKeyPrefix, hashApiKey, type ApiKeyScope } from "@/lib/api-keys";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

const createApiKeySchema = z.object({
  name: z.string().min(2).max(100),
  scope: z.enum(["read-only", "write", "admin"]).default("write"),
  expiresAt: z.string().datetime().optional(),
});

function splitNameAndScope(name: string): { displayName: string; scope: ApiKeyScope } {
  const match = name.match(/\[(read-only|write|admin)\]$/);
  if (!match) return { displayName: name, scope: "write" };
  return {
    displayName: name.replace(/\s*\[(read-only|write|admin)\]$/, ""),
    scope: match[1] as ApiKeyScope,
  };
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const items = await db.apiKey.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      isActive: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
    },
  });

  return NextResponse.json(
    ok(
      items.map((item) => {
        const parsed = splitNameAndScope(item.name);
        return { ...item, name: parsed.displayName, scope: parsed.scope };
      }),
      { total: items.length },
    ),
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const payload = createApiKeySchema.safeParse(await request.json());
  if (!payload.success) return NextResponse.json(fail("Invalid request body"), { status: 400 });

  const rawKey = generateApiKey();
  const keyHash = await hashApiKey(rawKey);
  const prefix = getApiKeyPrefix(rawKey);

  const created = await db.apiKey.create({
    data: {
      name: `${payload.data.name} [${payload.data.scope}]`,
      keyHash,
      prefix,
      expiresAt: payload.data.expiresAt ? new Date(payload.data.expiresAt) : null,
    },
    select: { id: true, name: true, prefix: true, createdAt: true, expiresAt: true },
  });

  return NextResponse.json(
    ok(
      {
        ...created,
        key: rawKey,
        scope: payload.data.scope,
      },
      { shownOnce: true },
    ),
    { status: 201 },
  );
}
