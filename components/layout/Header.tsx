"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

// Minimal top nav (kills decision fatigue); everything else lives in the footer.
const NAV = [
  { href: "/about", label: "About" },
  { href: "/new-here", label: "New Here" },
  { href: "/watch", label: "Watch" },
  { href: "/give", label: "Give" },
  { href: "/events", label: "Events" },
];

export function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border/80 bg-bg/85 backdrop-blur transition-shadow",
        scrolled && "shadow-sm"
      )}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-[70px] max-w-6xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          Kingdom<span className="text-primary"> Builders</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-[15px] font-medium text-fg/80 transition-colors hover:text-primary">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/new-here" className="hidden text-sm font-semibold text-primary hover:underline sm:inline">
            I&apos;m New
          </Link>
          <Button href="/new-here" size="sm" className="hidden sm:inline-flex">
            Plan Your Visit
          </Button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-fg lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-border bg-bg lg:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-4">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 text-base font-medium hover:bg-surface-2"
              >
                {n.label}
              </Link>
            ))}
            <Button href="/new-here" className="mt-2 w-full" onClick={() => setOpen(false)}>
              Plan Your Visit
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
