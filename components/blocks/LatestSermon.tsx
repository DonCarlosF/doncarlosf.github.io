import Link from "next/link";
import { Play } from "lucide-react";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { SmartImage } from "@/components/ui/Media";
import { ClipRail } from "@/components/watch/ClipRail";
import type { Sermon } from "@/lib/content/types";

export function LatestSermon({ sermon }: { sermon: Sermon | null }) {
  if (!sermon) return null;
  return (
    <Section tone="surface-2" id="latest-message">
      <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <Link href={`/watch/${sermon.slug}`} className="group relative block" aria-label={`Watch: ${sermon.title}`}>
          <SmartImage image={sermon.thumbnail || { alt: `${sermon.title} thumbnail`, placeholder: true }} priority />
          <span className="absolute left-4 top-4 rounded-full bg-cta px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cta-fg">
            ● Latest Message
          </span>
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-primary shadow-lg transition-transform group-hover:scale-110">
              <Play size={26} aria-hidden />
            </span>
          </span>
        </Link>

        <div>
          <Eyebrow>Watch &amp; Grow</Eyebrow>
          <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{sermon.title}</h2>
          <p className="mt-2 text-muted">
            {sermon.speaker?.name}
            {sermon.series?.title ? ` · ${sermon.series.title}` : ""}
            {sermon.scriptureRefs?.length ? ` · ${sermon.scriptureRefs.join(", ")}` : ""}
          </p>
          {sermon.description && <p className="mt-4 text-muted">{sermon.description}</p>}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button href={`/watch/${sermon.slug}`}>Watch full message</Button>
            <Button href="/watch#archive" variant="outline">Sermon archive</Button>
          </div>

          {sermon.clips?.length ? (
            <div className="mt-8">
              <p className="mb-3 text-sm font-semibold">Clips for your feed</p>
              <ClipRail clips={sermon.clips} />
            </div>
          ) : null}
        </div>
      </div>
    </Section>
  );
}
