import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { UserRole } from "@/types/enums";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/admin";

const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = registerSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: "Invalid registration payload", meta: null },
        { status: 400 },
      );
    }

    const sb = supabaseAdmin();

    const { data: existing } = await sb
      .from("users")
      .select("id")
      .eq("email", parsed.data.email)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        { data: null, error: "Email already registered", meta: null },
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const { data: user, error: createErr } = await sb
      .from("users")
      .insert({
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: UserRole.AGENT,
      })
      .select("id, name, email")
      .single();

    if (createErr || !user) {
      return NextResponse.json(
        { data: null, error: createErr?.message ?? "Failed to register user", meta: null },
        { status: 500 },
      );
    }

    void request;
    return NextResponse.json({ data: user, error: null, meta: null }, { status: 201 });
  } catch {
    return NextResponse.json(
      { data: null, error: "Failed to register user", meta: null },
      { status: 500 },
    );
  }
}
