"use client";

import { useState } from "react";
import { Flame, Play } from "lucide-react";
import { SmartImage } from "@/components/ui/Media";
import type { Clip } from "@/lib/content/types";

function youtubeId(url?: string): string | null {
  const m = url?.match(/(?:youtu\.be\/|shorts\/|v=|embed\/)([\w-]{11})/);
  return m?.[1] ?? null;
}

/** First platform post URL to link out to when inline play isn't available. */
function firstPostUrl(c: Clip): string | undefined {
  return c.platforms?.youtube || c.platforms?.instagram || c.platforms?.tiktok;
}

/**
 * Horizontal rail of vertical short-form clips (the bridge to church-clip-manager).
 * Contract: only `published` clips render, newest sermonDate first. Cards with a
 * YouTube URL play inline via a lite-embed facade (iframe loads on tap only);
 * otherwise they link to the first platform post; otherwise they're static.
 */
export function ClipRail({ clips }: { clips: Clip[] }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const visible = (clips ?? [])
    .filter((c) => c.status === "published")
    .sort(
      (a, b) =>
        (b.sermonDate ?? "").localeCompare(a.sermonDate ?? "") ||
        (b.viralityScore ?? 0) - (a.viralityScore ?? 0)
    );

  if (!visible.length) {
    return (
      <div className="rounded-card border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
        Clips from Sunday&apos;s message — coming soon.
      </div>
    );
  }

  return (
    <ul className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-3">
      {visible.map((clip) => {
        const yt = youtubeId(clip.platforms?.youtube);
        const post = firstPostUrl(clip);

        if (playing === clip._id && yt) {
          return (
            <li key={clip._id} className="w-32 shrink-0 snap-start sm:w-36">
              <div className="relative aspect-[9/16] overflow-hidden rounded-xl border border-border bg-black">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&playsinline=1`}
                  title={clip.hook}
                  className="absolute inset-0 h-full w-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </li>
          );
        }

        const card = (
          <div className="relative transition-transform duration-300 group-hover:-translate-y-1">
            <SmartImage
              image={clip.thumbnail || { alt: clip.hook, placeholder: true }}
              ratio="aspect-[9/16]"
              rounded="rounded-xl"
              imageClassName="transition-transform duration-500 group-hover:scale-105"
            />
            {typeof clip.viralityScore === "number" && (
              <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold text-white">
                <Flame size={11} aria-hidden /> {clip.viralityScore}
              </span>
            )}
            {(yt || post) && (
              <span className="absolute inset-0 flex items-center justify-center" aria-hidden>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-primary shadow">
                  <Play size={18} />
                </span>
              </span>
            )}
            <span className="absolute inset-x-2 bottom-2 line-clamp-2 text-[11px] font-semibold text-white drop-shadow">
              {clip.hook}
            </span>
          </div>
        );

        return (
          <li key={clip._id} className="group w-32 shrink-0 snap-start sm:w-36">
            {yt ? (
              <button type="button" onClick={() => setPlaying(clip._id)} aria-label={`Play clip: ${clip.hook}`} className="block w-full text-left">
                {card}
              </button>
            ) : post ? (
              <a href={post} target="_blank" rel="noopener noreferrer" aria-label={`Watch clip: ${clip.hook}`} className="block">
                {card}
              </a>
            ) : (
              card
            )}
          </li>
        );
      })}
    </ul>
  );
}
