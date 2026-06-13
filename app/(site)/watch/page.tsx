import type { Metadata } from "next";
import Link from "next/link";
import { MonitorPlay, Search } from "lucide-react";
import { PageHeader } from "@/components/blocks/PageHeader";
import { Section, SectionHeading, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { BoxcastEmbed } from "@/components/watch/BoxcastEmbed";
import { SermonCard } from "@/components/watch/SermonCard";
import { ClipRail } from "@/components/watch/ClipRail";
import { getSiteSettings, getSermons, getClips } from "@/lib/content";

export const metadata: Metadata = {
  title: "Watch",
  description: "Watch KBCF live via BoxCast, or catch up on past messages and clips.",
};

export default async function WatchPage() {
  const [settings, sermons, clips] = await Promise.all([getSiteSettings(), getSermons(), getClips()]);
  const youtube = settings.social.find((s) => s.platform === "youtube");
  const facebook = settings.social.find((s) => s.platform === "facebook");

  return (
    <>
      <PageHeader
        eyebrow="Watch"
        title="Live every weekend. Available anytime."
        intro="Join us live for worship, or catch up on past messages and short clips made for your feed."
      />

      <Section>
        <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <Eyebrow>Live now / next up</Eyebrow>
            <h2 className="mb-4 mt-2 font-display text-2xl font-semibold">KBCF Live</h2>
            <BoxcastEmbed id={settings.boxcastId} />
            <p className="mt-3 text-sm text-muted">
              Streaming via BoxCast. The player shows the live service when we&apos;re on air, and the next scheduled
              broadcast otherwise.
            </p>
          </div>
          <aside className="rounded-card border border-border bg-surface p-6">
            <h2 className="font-display text-xl font-semibold">Watch elsewhere</h2>
            <p className="mt-2 text-sm text-muted">Prefer to watch on social? Catch the simulcast:</p>
            <div className="mt-4 flex flex-col gap-3">
              {youtube ? (
                <Button href={youtube.url} variant="outline"><MonitorPlay size={18} aria-hidden /> YouTube</Button>
              ) : (
                <p className="rounded-btn border border-dashed border-border px-4 py-2.5 text-sm text-muted">YouTube link — add in CMS</p>
              )}
              {facebook ? (
                <Button href={facebook.url} variant="outline"><MonitorPlay size={18} aria-hidden /> Facebook</Button>
              ) : (
                <p className="rounded-btn border border-dashed border-border px-4 py-2.5 text-sm text-muted">Facebook link — add in CMS</p>
              )}
              <Button href="/search" variant="ghost"><Search size={18} aria-hidden /> Search messages</Button>
            </div>
          </aside>
        </div>
      </Section>

      {clips.length > 0 && (
        <Section tone="surface-2">
          <SectionHeading eyebrow="Shorts" title="Clips for your feed" />
          <div className="mt-8">
            <ClipRail clips={clips} />
          </div>
        </Section>
      )}

      <Section id="archive">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading eyebrow="Archive" title="Past messages" />
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm font-semibold text-primary">
            <Link href="/watch/series" className="hover:underline">Browse by series →</Link>
            <Link href="/search" className="hover:underline">Search messages →</Link>
          </div>
        </div>
        <div className="mt-8 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {sermons.map((s) => (
            <SermonCard key={s._id} sermon={s} />
          ))}
        </div>
      </Section>
    </>
  );
}
