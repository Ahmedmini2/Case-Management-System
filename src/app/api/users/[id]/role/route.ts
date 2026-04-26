import { NextResponse } from "next/server";
import { UserRole } from "@/types/enums";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({
  role: z.nativeEnum(UserRole),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(fail("Unauthorized"), { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(fail("Invalid request body"), { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("users")
    .update({ role: parsed.data.role })
    .eq("id", id)
    .select("id, name, email, role")
    .single();

  if (error) return NextResponse.json(fail(error.message), { status: 500 });
  return NextResponse.json(ok(data));
}
