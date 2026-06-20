"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Check, ChevronDown } from "lucide-react";
import { useTheme, type Theme } from "./ThemeProvider";
import { cn } from "@/lib/utils/cn";

/** The five art directions, in spectrum order (warm/calm → bold/kinetic). Each
 *  swatch previews the theme's signature primary→accent gradient. */
const OPTIONS: { value: Theme; label: string; vibe: string; from: string; to: string }[] = [
  { value: "sanctuary", label: "Sanctuary", vibe: "Warm · editorial", from: "#7a1e2b", to: "#e0a53a" },
  { value: "grove", label: "Grove", vibe: "Fresh · organic", from: "#2f6b4f", to: "#d98a4e" },
  { value: "sterling", label: "Sterling", vibe: "Crisp · modern", from: "#15171c", to: "#3d5afe" },
  { value: "ember", label: "Ember", vibe: "Warm · intimate", from: "#d98a3d", to: "#d4622a" },
  { value: "movement", label: "Movement", vibe: "Bold · kinetic", from: "#5b4dff", to: "#ff5436" },
];

/**
 * Preview affordance: lets reviewers flip between the five art directions live.
 * (Gate behind NEXT_PUBLIC_SHOW_THEME_SWITCHER=false once a direction is chosen.)
 */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.value === theme) ?? OPTIONS[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-4 right-4 z-50 text-fg">
      {open && (
        <div
          role="listbox"
          aria-label="Design direction"
          className="mb-2 w-64 overflow-hidden rounded-2xl border border-border bg-surface/97 p-1.5 shadow-2xl backdrop-blur"
        >
          <p className="px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            Design direction
          </p>
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              role="option"
              aria-selected={theme === o.value}
              type="button"
              onClick={() => {
                setTheme(o.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                theme === o.value ? "bg-surface-2" : "hover:bg-surface-2/60"
              )}
            >
              <span
                className="h-7 w-7 shrink-0 rounded-full border border-border"
                style={{ background: `linear-gradient(135deg, ${o.from}, ${o.to})` }}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block text-xs text-muted">{o.vibe}</span>
              </span>
              {theme === o.value && <Check size={16} className="shrink-0 text-primary" aria-hidden />}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Choose a design direction"
        className="flex items-center gap-2 rounded-full border border-border bg-surface/95 py-2 pl-2.5 pr-3 text-sm font-semibold shadow-lg backdrop-blur"
      >
        <span
          className="h-4 w-4 rounded-full"
          style={{ background: `linear-gradient(135deg, ${current.from}, ${current.to})` }}
          aria-hidden
        />
        <Palette size={15} className="text-muted" aria-hidden />
        <span>{current.label}</span>
        <ChevronDown size={14} className={cn("text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
    </div>
  );
}
