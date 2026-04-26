"use client";

import { createBrowserClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase browser client not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  cached = createBrowserClient(url, anonKey, {
    cookies: {
      get(_name: string): string | undefined { return undefined; },
      set(_name: string, _value: string, _options: CookieOptions): void {},
      remove(_name: string, _options: CookieOptions): void {},
    },
  });
  return cached;
}
