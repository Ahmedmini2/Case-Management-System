import { CaseStatus, Priority } from "@prisma/client";

export type CaseListItem = {
  id: string;
  caseNumber: string;
  title: string;
  status: CaseStatus;
  priority: Priority;
  source: string;
  createdAt: string;
  dueDate: string | null;
  assignedTo: { id: string; name: string | null; email: string | null } | null;
  tags: Array<{ id: string; name: string; color: string }>;
};
