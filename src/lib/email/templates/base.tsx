import * as React from "react";
import { Body, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";

type BaseTemplateProps = {
  preview: string;
  heading: string;
  intro: string;
  details: Array<{ label: string; value: string }>;
  caseUrl: string;
};

export function BaseEmailTemplate({ preview, heading, intro, details, caseUrl }: BaseTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f8fafc", fontFamily: "Arial, sans-serif" }}>
        <Container style={{ margin: "24px auto", maxWidth: "560px", backgroundColor: "#ffffff", padding: "24px" }}>
          <Section>
            <Text style={{ margin: 0, color: "#6b7280", fontSize: "12px" }}>Case Management System</Text>
            <Text style={{ margin: "8px 0 0", fontSize: "22px", fontWeight: 700 }}>{heading}</Text>
          </Section>
          <Text style={{ color: "#111827", fontSize: "14px", lineHeight: "22px" }}>{intro}</Text>
          <Section>
            {details.map((item) => (
              <Text key={item.label} style={{ margin: "6px 0", fontSize: "14px", color: "#111827" }}>
                <strong>{item.label}:</strong> {item.value}
              </Text>
            ))}
          </Section>
          <Text style={{ fontSize: "14px" }}>
            Open case: <a href={caseUrl}>{caseUrl}</a>
          </Text>
          <Hr />
          <Text style={{ color: "#6b7280", fontSize: "12px", lineHeight: "18px" }}>
            You are receiving this notification from Case Management System. Manage preferences in notification
            settings.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function baseTextTemplate({
  heading,
  intro,
  details,
  caseUrl,
}: Omit<BaseTemplateProps, "preview">) {
  return `${heading}

${intro}

${details.map((d) => `${d.label}: ${d.value}`).join("\n")}

Open case: ${caseUrl}

Manage notification settings in your Case Management account.`;
}
