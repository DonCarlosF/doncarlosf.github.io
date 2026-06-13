import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Section, Eyebrow } from "@/components/ui/Section";
import { SmartImage } from "@/components/ui/Media";
import { ClipRail } from "@/components/watch/ClipRail";
import { BoxcastEmbed } from "@/components/watch/BoxcastEmbed";
import { JsonLd } from "@/components/seo/JsonLd";
import { getSermon, getSermons } from "@/lib/content";
import { formatDate } from "@/lib/utils/format";

export async function generateStaticParams() {
  const sermons = await getSermons();
  return sermons.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const sermon = await getSermon(slug);
  if (!sermon) return { title: "Message not found" };
  return {
    title: sermon.title,
    description: sermon.description || `A message from ${sermon.speaker?.name || "KBCF"}.`,
  };
}

function youtubeEmbed(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

export default async function SermonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sermon = await getSermon(slug);
  if (!sermon) notFound();

  const yt = youtubeEmbed(sermon.videoUrl);

  return (
    <Section>
      <Link href="/watch#archive" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2">
        <ArrowLeft size={16} aria-hidden /> All messages
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <div>
          {yt ? (
            <div className="relative aspect-video overflow-hidden rounded-card border border-border bg-black">
              <iframe src={yt} title={sermon.title} className="absolute inset-0 h-full w-full" allowFullScreen loading="lazy" />
            </div>
          ) : sermon.boxcastId ? (
            <BoxcastEmbed id={sermon.boxcastId} title={sermon.title} />
          ) : (
            <SmartImage image={sermon.thumbnail || { alt: `${sermon.title} thumbnail`, placeholder: true }} priority />
          )}

          {sermon.description && <p className="mt-6 text-lg text-muted">{sermon.description}</p>}

          {sermon.clips?.length ? (
            <div className="mt-10">
              <h2 className="mb-3 font-display text-xl font-semibold">Clips from this message</h2>
              <ClipRail clips={sermon.clips} />
            </div>
          ) : null}
        </div>

        <aside>
          <Eyebrow>{formatDate(sermon.date)}</Eyebrow>
          <h1 className="mt-2 font-display text-3xl font-semibold">{sermon.title}</h1>
          <dl className="mt-6 space-y-3 text-sm">
            {sermon.speaker?.name && (
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <dt className="text-muted">Speaker</dt><dd className="font-medium">{sermon.speaker.name}</dd>
              </div>
            )}
            {sermon.series?.title && (
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <dt className="text-muted">Series</dt><dd className="font-medium">{sermon.series.title}</dd>
              </div>
            )}
            {sermon.scriptureRefs?.length ? (
              <div className="flex justify-between gap-4 border-b border-border pb-3">
                <dt className="text-muted">Scripture</dt><dd className="font-medium">{sermon.scriptureRefs.join(", ")}</dd>
              </div>
            ) : null}
          </dl>
        </aside>
      </div>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "VideoObject",
          name: sermon.title,
          description: sermon.description || `A message from ${sermon.speaker?.name || "KBCF"}.`,
          uploadDate: sermon.date,
          ...(sermon.videoUrl ? { contentUrl: sermon.videoUrl } : {}),
        }}
      />
    </Section>
  );
}
