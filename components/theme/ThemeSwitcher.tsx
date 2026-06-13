"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";
import { useTheme, type Theme } from "./ThemeProvider";
import { cn } from "@/lib/utils/cn";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "sanctuary", label: "Sanctuary" },
  { value: "movement", label: "Movement" },
];

/**
 * Preview affordance: lets reviewers flip between the two art directions live.
 * (Easy to remove or gate behind an env flag once a direction is chosen.)
 */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div
      role="group"
      aria-label="Choose a design direction"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1 rounded-full border border-border bg-surface/95 p-1 shadow-lg backdrop-blur"
    >
      <span className="pl-2 pr-1 text-muted" aria-hidden>
        <Palette size={15} />
      </span>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setTheme(o.value)}
          aria-pressed={theme === o.value}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
            theme === o.value ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
