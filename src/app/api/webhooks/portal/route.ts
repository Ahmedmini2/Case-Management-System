import { nanoid } from "nanoid";
import { NextResponse } from "next/server";
import { generateCaseNumber } from "@/lib/case-number";
import { supabaseAdmin } from "@/lib/supabase/admin";

type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

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

    const validPriorities: Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    const priority: Priority = validPriorities.includes(priorityRaw as Priority)
      ? (priorityRaw as Priority)
      : "MEDIUM";

    const sb = supabaseAdmin();

    // Upsert contact by email
    const { data: existingContact } = await sb
      .from("contacts")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    let contactId: string;
    if (existingContact) {
      contactId = (existingContact as { id: string }).id;
      await sb.from("contacts").update({ name }).eq("id", contactId);
    } else {
      const { data: newContact, error: cErr } = await sb
        .from("contacts")
        .insert({ email, name })
        .select("id")
        .single();
      if (cErr || !newContact) {
        return NextResponse.json(
          { success: false, error: cErr?.message ?? "Failed to create contact" },
          { status: 500 },
        );
      }
      contactId = (newContact as { id: string }).id;
    }

    const caseNumber = await generateCaseNumber();
    const portalToken = nanoid(32);

    // Find default pipeline + first stage
    let pipelineId: string | null = null;
    let firstStageId: string | null = null;

    const { data: existingPipeline } = await sb
      .from("pipelines")
      .select("id")
      .eq("isDefault", true)
      .maybeSingle();

    if (existingPipeline) {
      pipelineId = (existingPipeline as { id: string }).id;
      const { data: stage } = await sb
        .from("pipeline_stages")
        .select("id")
        .eq("pipelineId", pipelineId)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      firstStageId = stage ? (stage as { id: string }).id : null;
    } else {
      const { data: newPipeline, error: pErr } = await sb
        .from("pipelines")
        .insert({ name: "Default Pipeline", isDefault: true })
        .select("id")
        .single();
      if (pErr || !newPipeline) {
        return NextResponse.json(
          { success: false, error: pErr?.message ?? "Failed to create pipeline" },
          { status: 500 },
        );
      }
      pipelineId = (newPipeline as { id: string }).id;

      const stagesPayload = [
        { pipelineId, name: "Open", position: 0, color: "#6366f1" },
        { pipelineId, name: "In Progress", position: 1, color: "#f59e0b" },
        { pipelineId, name: "Waiting", position: 2, color: "#8b5cf6" },
        { pipelineId, name: "Resolved", position: 3, color: "#10b981", isTerminal: true },
      ];
      const { data: stagesCreated, error: sErr } = await sb
        .from("pipeline_stages")
        .insert(stagesPayload)
        .select("id, position");
      if (sErr) {
        console.error("[webhooks/portal] Stage create error:", sErr.message);
      }
      const sortedStages = ((stagesCreated ?? []) as { id: string; position: number }[]).sort(
        (a, b) => a.position - b.position,
      );
      firstStageId = sortedStages[0]?.id ?? null;
    }

    // Find or upsert system user for portal cases
    const { data: existingSysUser } = await sb
      .from("users")
      .select("id")
      .eq("email", "portal@system.internal")
      .maybeSingle();

    let systemUserId: string;
    if (existingSysUser) {
      systemUserId = (existingSysUser as { id: string }).id;
    } else {
      const { data: newSysUser, error: uErr } = await sb
        .from("users")
        .insert({
          email: "portal@system.internal",
          name: "Portal Bot",
          role: "AGENT",
        })
        .select("id")
        .single();
      if (uErr || !newSysUser) {
        return NextResponse.json(
          { success: false, error: uErr?.message ?? "Failed to create system user" },
          { status: 500 },
        );
      }
      systemUserId = (newSysUser as { id: string }).id;
    }

    // Build description with order number
    const fullDescription = orderNumber
      ? `${description}\n\n---\nOrder Number: ${orderNumber}`
      : description;

    // Create case + activity (sequential, best-effort for activity)
    const { data: caseItem, error: caseErr } = await sb
      .from("cases")
      .insert({
        caseNumber,
        title: subject,
        description: fullDescription,
        status: "OPEN",
        priority,
        type: type || null,
        source: "PORTAL",
        contactId,
        createdById: systemUserId,
        pipelineId,
        pipelineStageId: firstStageId,
        metadata: {
          portalToken,
          orderNumber: orderNumber || null,
          submittedAt: new Date().toISOString(),
        },
      })
      .select("id, caseNumber")
      .single();

    if (caseErr || !caseItem) {
      return NextResponse.json(
        { success: false, error: caseErr?.message ?? "Failed to create case" },
        { status: 500 },
      );
    }

    const created = caseItem as { id: string; caseNumber: string };

    const { error: actErr } = await sb.from("activities").insert({
      caseId: created.id,
      userId: systemUserId,
      type: "CREATED",
      description: `Case submitted via customer portal by ${name}`,
    });
    if (actErr) console.error("[webhooks/portal] best-effort activity failed:", actErr.message);

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
