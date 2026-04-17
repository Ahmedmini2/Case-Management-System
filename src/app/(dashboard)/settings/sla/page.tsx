"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function SlaSettingsPage() {
  const [result, setResult] = useState("");

  async function runCheck() {
    setResult("Running SLA check...");
    const res = await fetch("/api/sla/check", { method: "POST" });
    const json = (await res.json()) as { data?: { breached?: number }; error?: string };
    if (!res.ok) {
      setResult(json.error ?? "Failed.");
      return;
    }
    setResult(`SLA check complete. Breached cases: ${json.data?.breached ?? 0}`);
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-medium">SLA Policies</h2>
      <p className="text-sm text-muted-foreground">Run scheduled SLA checks manually for now.</p>
      <Button onClick={runCheck}>Run SLA Check</Button>
      {result ? <p className="text-sm text-muted-foreground">{result}</p> : null}
    </div>
  );
}
