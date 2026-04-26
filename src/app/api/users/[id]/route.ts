import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  email: z.string().email().optional(),
  image: z.string().url().or(z.string().startsWith("/")).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(fail("Invalid request body"), { status: 400 });
  }

  const sb = supabaseAdmin();

  if (parsed.data.email) {
    const { data: existing } = await sb
      .from("users")
      .select("id")
      .eq("email", parsed.data.email)
      .neq("id", id)
      .maybeSingle();
    if (existing) {
      return NextResponse.json(fail("Email already exists"), { status: 409 });
    }
  }

  const updateData: Record<string, unknown> = {};
  if (typeof parsed.data.name !== "undefined") updateData.name = parsed.data.name;
  if (typeof parsed.data.email !== "undefined") updateData.email = parsed.data.email;
  if (typeof parsed.data.image !== "undefined") updateData.image = parsed.data.image;

  const { data, error } = await sb
    .from("users")
    .update(updateData)
    .eq("id", id)
    .select("id, name, email, image, role, updatedAt")
    .single();

  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  return NextResponse.json(ok(data));
}
