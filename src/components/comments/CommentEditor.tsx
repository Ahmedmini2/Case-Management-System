"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type CreatedComment = {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author: { name: string | null; email: string | null };
};

export function CommentEditor({
  caseId,
  onCreated,
}: {
  caseId: string;
  onCreated: (comment: CreatedComment) => void;
}) {
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function submitComment() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed, isInternal }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({ error: null }))) as { error: string | null };
        toast.error(result.error ?? "Failed to add comment");
        return;
      }
      const result = (await response.json()) as { data: CreatedComment };
      setBody("");
      setIsInternal(false);
      onCreated(result.data);
    } finally {
      setIsSaving(false);
    }
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
