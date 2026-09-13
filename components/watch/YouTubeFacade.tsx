"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { SmartImage } from "@/components/ui/Media";
import type { Img } from "@/lib/content/types";

/**
 * Click-to-load YouTube player for sermon pages: a poster and play button until
 * tapped, then the youtube-nocookie embed. Mirrors BoxcastFacade so no player
 * runtime loads with the page.
 */
export function YouTubeFacade({ id, title, poster }: { id: string; title: string; poster?: Img }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-card border border-border bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1`}
          title={title}
          className="absolute inset-0 h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  const image: Img =
    poster?.src && !poster.placeholder
      ? poster
      : { src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, alt: poster?.alt || `${title} — video thumbnail` };

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group relative block w-full overflow-hidden rounded-card border border-border text-left"
    >
      <SmartImage
        image={image}
        preload
        sizes="(min-width: 1024px) 60vw, 100vw"
        rounded="rounded-none"
        imageClassName="transition-transform duration-500 group-hover:scale-[1.02]"
      />
      <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-primary shadow-lg transition-transform group-hover:scale-110">
          <Play size={26} />
        </span>
      </span>
      <span className="sr-only">Play video: {title}</span>
    </button>
  );
}
