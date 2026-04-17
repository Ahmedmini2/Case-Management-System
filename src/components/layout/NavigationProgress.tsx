"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incrementTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Route changed — start progress
    setVisible(true);
    setProgress(10);

    // Increment slowly to 85%
    incrementTimer.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 85) {
          if (incrementTimer.current) clearInterval(incrementTimer.current);
          return 85;
        }
        return prev + Math.random() * 8;
      });
    }, 200);

    // Complete after a short grace period
    timer.current = setTimeout(() => {
      if (incrementTimer.current) clearInterval(incrementTimer.current);
      setProgress(100);
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 300);
    }, 600);

    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (incrementTimer.current) clearInterval(incrementTimer.current);
    };
  }, [pathname, searchParams]);

  if (!visible && progress === 0) return null;

  return (
    <div className="pointer-events-none fixed left-0 top-0 z-[100] h-0.5 w-full">
      <div
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}
