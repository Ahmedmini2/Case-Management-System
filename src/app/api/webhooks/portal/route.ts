import { nanoid } from "nanoid";
import { ActivityType, CaseSource, CaseStatus, Priority } from "@prisma/client";
import { NextResponse } from "next/server";
import { generateCaseNumber } from "@/lib/case-number";
import { db } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const orderNumber = typeof body.orderNumber === "string" ? body.orderNumber.trim() : "";
    const type = typeof body.type === "string" ? body.type.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const priorityRaw = typeof body.priority === "string" ? body.priority.trim().toUpperCase() : "MEDIUM";

    if (!name || !email || !subject || !description) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: name, email, subject, description" },
        { status: 400 },
      );
    }

    const validPriorities = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
    const priority = validPriorities.includes(priorityRaw as Priority)
      ? (priorityRaw as Priority)
      : Priority.MEDIUM;

    // Upsert contact by email
    const contact = await db.contact.upsert({
      where: { email },
      update: { name },
      create: { email, name },
      select: { id: true },
    });

    const caseNumber = await generateCaseNumber();
    const portalToken = nanoid(32);

    // Find or create default pipeline
    let pipeline = await db.pipeline.findFirst({
      where: { isDefault: true },
      select: {
        id: true,
        stages: { orderBy: { position: "asc" }, take: 1, select: { id: true } },
      },
    });

    if (!pipeline) {
      pipeline = await db.pipeline.create({
        data: {
          name: "Default Pipeline",
          isDefault: true,
          stages: {
            create: [
              { name: "Open", position: 0, color: "#6366f1" },
              { name: "In Progress", position: 1, color: "#f59e0b" },
              { name: "Waiting", position: 2, color: "#8b5cf6" },
              { name: "Resolved", position: 3, color: "#10b981", isTerminal: true },
            ],
          },
        },
        select: {
          id: true,
          stages: { orderBy: { position: "asc" }, take: 1, select: { id: true } },
        },
      });
    }

    const firstStageId = pipeline.stages[0]?.id ?? null;

    // Find or create system user for portal cases
    const systemUser = await db.user.upsert({
      where: { email: "portal@system.internal" },
      update: {},
      create: {
        email: "portal@system.internal",
        name: "Portal Bot",
        role: "AGENT",
      },
      select: { id: true },
    });

    // Build description with order number
    const fullDescription = orderNumber
      ? `${description}\n\n---\nOrder Number: ${orderNumber}`
      : description;

    // Create case + activity in a transaction
    const created = await db.$transaction(async (tx) => {
      const caseItem = await tx.case.create({
        data: {
          caseNumber,
          title: subject,
          description: fullDescription,
          status: CaseStatus.OPEN,
          priority,
          type: type || null,
          source: CaseSource.PORTAL,
          contactId: contact.id,
          createdById: systemUser.id,
          pipelineId: pipeline!.id,
          pipelineStageId: firstStageId,
          metadata: {
            portalToken,
            orderNumber: orderNumber || null,
            submittedAt: new Date().toISOString(),
          },
        },
        select: { id: true, caseNumber: true },
      });

      await tx.activity.create({
        data: {
          caseId: caseItem.id,
          userId: systemUser.id,
          type: ActivityType.CREATED,
          description: `Case submitted via customer portal by ${name}`,
        },
      });

      return caseItem;
    });

    return NextResponse.json(
      {
        success: true,
        caseNumber: created.caseNumber,
        caseId: created.id,
        portalToken,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[webhooks/portal] Error creating portal case:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
