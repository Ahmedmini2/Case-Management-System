"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type SearchCase = { id: string; caseNumber: string; title: string };

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cases, setCases] = useState<SearchCase[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      const metaK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (metaK) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeydown);
    return () => window.removeEventListener("keydown", onKeydown);
  }, []);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/cases?q=${encodeURIComponent(query)}&take=10`);
      const json = (await res.json()) as { data: SearchCase[] | null };
      setCases(json.data ?? []);
    }
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void load();
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [open, query]);

  const quickNav = useMemo(
    () => [
      { label: "Go Dashboard (G D)", href: "/" },
      { label: "Go Board (G B)", href: "/board" },
      { label: "New Case (N)", href: "/cases/new" },
      { label: "Notifications", href: "/notifications" },
    ],
    [],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="p-0">
        <Command>
          <CommandInput placeholder="Search cases, contacts, emails..." value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandGroup heading="Quick Actions">
              {quickNav.map((item) => (
                <CommandItem
                  key={item.href}
                  onSelect={() => {
                    setOpen(false);
                    router.push(item.href);
                  }}
                >
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Cases">
              {cases.map((item) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => {
                    setOpen(false);
                    router.push(`/cases/${item.id}`);
                  }}
                >
                  {item.caseNumber} - {item.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
