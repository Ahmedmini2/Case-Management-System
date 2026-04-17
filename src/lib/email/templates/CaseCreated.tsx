import * as React from "react";
import { BaseEmailTemplate, baseTextTemplate } from "@/lib/email/templates/base";

type Props = {
  caseNumber: string;
  caseTitle: string;
  status: string;
  priority: string;
  assignee?: string | null;
  updateMessage?: string;
  caseUrl: string;
};

export function CaseCreatedEmail(props: Props) {
  return (
    <BaseEmailTemplate
      preview={`New case ${props.caseNumber}`}
      heading="Case Created"
      intro={props.updateMessage ?? "A new case has been created."}
      details={[
        { label: "Case", value: `${props.caseNumber} - ${props.caseTitle}` },
        { label: "Status", value: props.status },
        { label: "Priority", value: props.priority },
        { label: "Assignee", value: props.assignee ?? "Unassigned" },
      ]}
      caseUrl={props.caseUrl}
    />
  );
}

export function caseCreatedText(props: Props) {
  return baseTextTemplate({
    heading: "Case Created",
    intro: props.updateMessage ?? "A new case has been created.",
    details: [
      { label: "Case", value: `${props.caseNumber} - ${props.caseTitle}` },
      { label: "Status", value: props.status },
      { label: "Priority", value: props.priority },
      { label: "Assignee", value: props.assignee ?? "Unassigned" },
    ],
    caseUrl: props.caseUrl,
  });
}
