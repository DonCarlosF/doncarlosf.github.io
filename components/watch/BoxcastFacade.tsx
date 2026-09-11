"use client";

import { useState } from "react";
import { MonitorPlay, Play } from "lucide-react";
import { BoxcastEmbed } from "./BoxcastEmbed";
import { cn } from "@/lib/utils/cn";

/**
 * Click-to-load facade for the BoxCast embed: renders a lightweight themed
 * poster (zero iframes at page load — the Home LCP fix) and swaps in the real
 * player only when the visitor taps. Full embeds live on /watch.
 */
export function BoxcastFacade({
  id,
  title = "KBCF Live",
  heightClass = "aspect-video",
}: {
  id?: string;
  title?: string;
  heightClass?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  if (!id) return <BoxcastEmbed id={id} title={title} />; // themed "coming soon" state

  if (loaded) return <BoxcastEmbed id={id} title={title} heightClass={heightClass} />;

  return (
    <button
      type="button"
      onClick={() => setLoaded(true)}
      className={cn(
        "hero-grain group relative isolate block w-full overflow-hidden rounded-card border border-border text-left text-white",
        heightClass
      )}
    >
      <span className="hero-bg absolute inset-0 -z-10" aria-hidden />
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-primary shadow-lg transition-transform group-hover:scale-110">
          <Play size={26} aria-hidden />
        </span>
        <span>
          <span className="block font-display text-xl font-semibold">{title}</span>
          <span className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/85">
            <MonitorPlay size={15} aria-hidden /> Tap to load the live player &amp; past services
          </span>
        </span>
      </span>
    </button>
  );
}
