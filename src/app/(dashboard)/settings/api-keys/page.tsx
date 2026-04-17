"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ApiKeyItem = {
  id: string;
  name: string;
  scope: "read-only" | "write" | "admin";
  prefix: string;
  isActive: boolean;
  createdAt: string;
};

export default function ApiKeysPage() {
  const [name, setName] = useState("");
  const [scope, setScope] = useState<ApiKeyItem["scope"]>("write");
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [createdKey, setCreatedKey] = useState("");

  async function load() {
    const res = await fetch("/api/api-keys");
    const json = (await res.json()) as { data: ApiKeyItem[] | null };
    setKeys(json.data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createKey() {
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, scope }),
    });
    const json = (await res.json()) as { data: { key?: string } | null };
    setCreatedKey(json.data?.key ?? "");
    setName("");
    await load();
  }

  async function revoke(id: string) {
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">API Keys</h1>
      <Card>
        <CardHeader>
          <CardTitle>Create API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Zapier Production" />
          </div>
          <div className="space-y-2">
            <Label>Scope</Label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as ApiKeyItem["scope"])}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="read-only">read-only</option>
              <option value="write">write</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <Button onClick={createKey}>Generate Key</Button>
          {createdKey ? (
            <p className="rounded-md bg-muted p-2 text-sm">
              Copy now (shown once): <code>{createdKey}</code>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="font-medium">
                  {key.name} ({key.scope})
                </p>
                <p className="text-xs text-muted-foreground">
                  Prefix: {key.prefix}... - {key.isActive ? "Active" : "Revoked"}
                </p>
              </div>
              {key.isActive ? (
                <Button variant="destructive" onClick={() => revoke(key.id)}>
                  Revoke
                </Button>
              ) : null}
            </div>
          ))}
          {!keys.length ? <p className="text-sm text-muted-foreground">No API keys yet.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
