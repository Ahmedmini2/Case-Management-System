"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Team = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  members: Array<{
    id: string;
    role: string;
    user: { id: string; name: string | null; email: string | null; role: string };
  }>;
};

export default function TeamSettingsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);

  async function load() {
    const res = await fetch("/api/teams");
    const json = (await res.json()) as { data: Team[] | null };
    setTeams(json.data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createTeam() {
    const response = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    if (!response.ok) {
      toast.error("Failed to create team");
      return;
    }
    setName("");
    setDescription("");
    await load();
    setOpen(false);
    toast.success("Team created.");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-medium">Team Management</h2>
        <p className="text-sm text-muted-foreground">Create teams and manage members.</p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="bg-indigo-600 hover:bg-indigo-500">Create Team</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
            <DialogDescription>Add a team for assignment and permissions.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={createTeam}>Save Team</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-3">
        {teams.map((team) => (
          <div key={team.id} className="rounded-md border p-4">
            <p className="font-medium">{team.name}</p>
            <p className="text-sm text-muted-foreground">{team.description ?? "No description"}</p>
            <p className="mt-2 text-xs text-muted-foreground">Members: {team.members.length}</p>
          </div>
        ))}
        {!teams.length ? <p className="text-sm text-muted-foreground">No teams created yet.</p> : null}
      </div>
    </div>
  );
}
