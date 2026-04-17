import { TeamRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";

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

  const teams = await db.team.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      createdAt: true,
      members: {
        select: {
          id: true,
          role: true,
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  });

  return NextResponse.json(ok(teams, { total: teams.length }));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json(fail("Unauthorized"), { status: 401 });

  const json = await request.json();
  const parsedTeam = createTeamSchema.safeParse(json);
  if (parsedTeam.success) {
    const created = await db.team.create({
      data: parsedTeam.data,
      select: { id: true, name: true, description: true, color: true, createdAt: true },
    });
    return NextResponse.json(ok(created), { status: 201 });
  }

  const parsedMember = addMemberSchema.safeParse(json);
  if (parsedMember.success) {
    const created = await db.teamMember.create({
      data: parsedMember.data,
      select: {
        id: true,
        teamId: true,
        userId: true,
        role: true,
      },
    });
    return NextResponse.json(ok(created), { status: 201 });
  }

  return NextResponse.json(fail("Invalid request body"), { status: 400 });
}
