const { PrismaClient, Priority, CaseStatus, CaseSource, UserRole } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo.agent@local.test" },
    update: {},
    create: {
      email: "demo.agent@local.test",
      name: "Demo Agent",
      role: UserRole.AGENT,
      isActive: true,
    },
  });

  let pipeline = await prisma.pipeline.findFirst({
    where: { isDefault: true },
    include: { stages: { orderBy: { position: "asc" } } },
  });

  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        name: "Default Pipeline",
        isDefault: true,
        stages: {
          create: [
            { name: "Backlog", position: 0, color: "#6366f1" },
            { name: "In Progress", position: 1, color: "#0ea5e9" },
            { name: "Done", position: 2, color: "#22c55e", isTerminal: true },
          ],
        },
      },
      include: { stages: { orderBy: { position: "asc" } } },
    });
  }

  const stages = pipeline.stages;
  const now = Date.now();
  const samples = [
    {
      title: "Customer cannot reset password",
      description: "Reset link fails with 500 error for multiple users.",
      priority: Priority.HIGH,
      status: CaseStatus.OPEN,
      stage: stages[0]?.id ?? null,
    },
    {
      title: "Invoice PDF attachment missing",
      description: "Outbound invoice email sent without PDF attachment.",
      priority: Priority.MEDIUM,
      status: CaseStatus.IN_PROGRESS,
      stage: stages[1]?.id ?? stages[0]?.id ?? null,
    },
    {
      title: "Mobile app crashes on login",
      description: "Android users report immediate crash after entering OTP.",
      priority: Priority.CRITICAL,
      status: CaseStatus.OPEN,
      stage: stages[0]?.id ?? null,
    },
  ];

  const created = [];
  for (let i = 0; i < samples.length; i += 1) {
    const s = samples[i];
    const c = await prisma.case.create({
      data: {
        caseNumber: `CASE-TEST-${now}-${i + 1}`,
        title: s.title,
        description: s.description,
        priority: s.priority,
        status: s.status,
        source: CaseSource.MANUAL,
        createdById: user.id,
        assignedToId: user.id,
        pipelineId: pipeline.id,
        pipelineStageId: s.stage,
      },
      select: { id: true, caseNumber: true, title: true },
    });
    created.push(c);
  }

  console.log("Created test cases:");
  for (const c of created) {
    console.log(`${c.caseNumber} | ${c.title} | ${c.id}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
