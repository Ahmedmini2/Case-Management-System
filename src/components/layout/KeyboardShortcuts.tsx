"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function KeyboardShortcuts() {
  const router = useRouter();
  const gPressedAt = useRef<number | null>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        router.push("/cases/new");
        return;
      }

      if (e.key.toLowerCase() === "g") {
        gPressedAt.current = Date.now();
        return;
      }

      if (gPressedAt.current && Date.now() - gPressedAt.current < 1000) {
        if (e.key.toLowerCase() === "b") {
          e.preventDefault();
          router.push("/board");
        } else if (e.key.toLowerCase() === "d") {
          e.preventDefault();
          router.push("/");
        }
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  return null;
}
