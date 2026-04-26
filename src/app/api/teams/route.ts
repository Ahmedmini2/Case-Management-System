import { TeamRole } from "@/types/enums";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const createTeamSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().optional(),
  color: z.string().optional(),
});

const addMemberSchema = z.object({
  teamId: z.string(),
  userId: z.string(),
  role: z.nativeEnum(TeamRole).default(TeamRole.MEMBER),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const sb = supabaseAdmin();
  const { data: teams, error } = await sb
    .from("teams")
    .select("id, name, description, color, createdAt")
    .order("createdAt", { ascending: false });

  if (error) return NextResponse.json(fail(error.message), { status: 500 });

  const teamList = teams ?? [];
  const teamIds = teamList.map((t) => t.id);

  type MemberRow = { id: string; teamId: string; userId: string; role: string };
  type UserRow = { id: string; name: string | null; email: string; role: string };

  let members: MemberRow[] = [];
  let userMap = new Map<string, UserRow>();

  if (teamIds.length > 0) {
    const { data: memberRows } = await sb
      .from("team_members")
      .select("id, teamId, userId, role")
      .in("teamId", teamIds);
    members = (memberRows ?? []) as MemberRow[];

    const userIds = [...new Set(members.map((m) => m.userId))];
    if (userIds.length > 0) {
      const { data: userRows } = await sb
        .from("users")
        .select("id, name, email, role")
        .in("id", userIds);
      for (const u of (userRows ?? []) as UserRow[]) userMap.set(u.id, u);
    }
  }

  const enriched = teamList.map((t) => ({
    ...t,
    members: members
      .filter((m) => m.teamId === t.id)
      .map((m) => ({
        id: m.id,
        role: m.role,
        user: userMap.get(m.userId) ?? null,
      })),
  }));

  return NextResponse.json(ok(enriched, { total: enriched.length }));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const json = await request.json();
  const parsedTeam = createTeamSchema.safeParse(json);
  const sb = supabaseAdmin();

  if (parsedTeam.success) {
    const { data, error } = await sb
      .from("teams")
      .insert(parsedTeam.data)
      .select("id, name, description, color, createdAt")
      .single();
    if (error) return NextResponse.json(fail(error.message), { status: 500 });
    return NextResponse.json(ok(data), { status: 201 });
  }

  const parsedMember = addMemberSchema.safeParse(json);
  if (parsedMember.success) {
    const { data, error } = await sb
      .from("team_members")
      .insert(parsedMember.data)
      .select("id, teamId, userId, role")
      .single();
    if (error) return NextResponse.json(fail(error.message), { status: 500 });
    return NextResponse.json(ok(data), { status: 201 });
  }

  return NextResponse.json(fail("Invalid request body"), { status: 400 });
}
