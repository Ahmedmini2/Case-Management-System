"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CommentEditor({
  caseId,
  onCreated,
}: {
  caseId: string;
  onCreated: () => void;
}) {
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function submitComment() {
    if (!body.trim()) return;
    setIsSaving(true);
    await fetch(`/api/cases/${caseId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, isInternal }),
    });
    setBody("");
    setIsInternal(false);
    setIsSaving(false);
    onCreated();
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="Add a comment..."
      />
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={isInternal}
          onChange={(e) => setIsInternal(e.target.checked)}
        />
        Internal note
      </label>
      <Button onClick={submitComment} disabled={isSaving}>
        {isSaving ? "Saving..." : "Add Comment"}
      </Button>
    </div>
  );
}
