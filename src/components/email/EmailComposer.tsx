"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Send, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  caseId: string;
  onSent?: () => void;
  defaultTo?: string;
  defaultSubject?: string;
};

export function EmailComposer({ caseId, onSent, defaultTo = "", defaultSubject = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const toAddresses = to
      .split(/[,;\s]+/)
      .map((e) => e.trim())
      .filter(Boolean);

    if (!toAddresses.length) {
      toast.error("Please enter at least one recipient");
      return;
    }
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!body.trim()) {
      toast.error("Message body is required");
      return;
    }

    setSending(true);
    const res = await fetch(`/api/cases/${caseId}/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: toAddresses, subject: subject.trim(), body: body.trim() }),
    });
    setSending(false);

    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      toast.error(json.error ?? "Failed to send email");
      return;
    }

    toast.success("Email queued for delivery");
    setTo(defaultTo);
    setSubject(defaultSubject);
    setBody("");
    setOpen(false);
    onSent?.();
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <Send className="h-3.5 w-3.5" />
        Compose Email
      </Button>
    );
  }

  return (
    <Card className="border-primary/30 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Send className="h-3.5 w-3.5 text-primary" />
            New Email
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={() => setOpen(false)}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={() => { setOpen(false); setTo(defaultTo); setSubject(defaultSubject); setBody(""); }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com, another@example.com"
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground/70">Separate multiple addresses with commas</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Subject</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            className="text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Message</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message here…"
            rows={6}
            className="resize-y text-sm"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setOpen(false)}
            disabled={sending}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => void send()}
            disabled={sending}
          >
            <Send className="h-3.5 w-3.5" />
            {sending ? "Sending…" : "Send Email"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
