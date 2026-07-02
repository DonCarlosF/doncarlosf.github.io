"use client";

import { useEffect, useState } from "react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import type { HeroSlide } from "@/lib/content/types";

/**
 * Auto-rotating hero slideshow. Reuses the theme hero CSS hooks (hero-section,
 * hero-bg, hero-glow, hero-eyebrow, hero-title, hero-accent, hero-cta-primary)
 * so all five art directions style it. Respects prefers-reduced-motion (no
 * auto-advance; the global reduced-motion rule also zeroes the fade).
 */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const items = slides?.length ? slides : [{ title: "Welcome", accent: "" }];
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (items.length < 2) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = setInterval(() => setActive((a) => (a + 1) % items.length), 6500);
    return () => clearInterval(id);
  }, [items.length]);

  return (
    <section
      className="hero-section hero-grain relative isolate flex min-h-[80vh] items-center overflow-hidden text-white"
      aria-roledescription="carousel"
      aria-label="Welcome"
    >
      <div className="hero-bg absolute inset-0 -z-10" aria-hidden />
      <div className="hero-glow" aria-hidden />

      <Container className="relative w-full py-20">
        <h1 className="sr-only">Kingdom Builders Christian Fellowship — Church Like No Other</h1>

        <div className="relative min-h-[300px] max-w-3xl sm:min-h-[340px]">
          {items.map((s, i) => (
            <div
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${items.length}`}
              aria-hidden={i !== active}
              // inert keeps the hidden slide's CTA out of the tab order (a11y:
              // aria-hidden content must not contain focusable elements).
              inert={i !== active}
              className={cn(
                "absolute inset-0 flex flex-col justify-center transition-opacity duration-700",
                i === active ? "opacity-100" : "pointer-events-none opacity-0"
              )}
            >
              {s.eyebrow && (
                <p className="hero-eyebrow text-xs font-semibold uppercase tracking-[0.22em] text-white/75">{s.eyebrow}</p>
              )}
              <p className="hero-title mt-4 text-5xl font-semibold leading-[1.02] sm:text-6xl lg:text-7xl">
                {s.title}
                {s.title && s.accent ? " " : ""}
                {s.accent && <span className="hero-accent">{s.accent}</span>}
              </p>
              {s.ctaLabel && s.ctaHref && (
                <div className="mt-8">
                  <Button href={s.ctaHref} size="lg" variant="accent" className="hero-cta-primary">
                    {s.ctaLabel}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {items.length > 1 && (
          <div className="mt-8 flex gap-2" role="tablist" aria-label="Choose a slide">
            {items.map((s, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Show slide ${i + 1}${[s.title, s.accent].filter(Boolean).length ? `: ${[s.title, s.accent].filter(Boolean).join(" ")}` : ""}`}
                onClick={() => setActive(i)}
                className={cn(
                  "h-2.5 rounded-full transition-all",
                  i === active ? "w-8 bg-white" : "w-2.5 bg-white/40 hover:bg-white/70"
                )}
              />
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
