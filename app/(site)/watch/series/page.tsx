import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/blocks/PageHeader";
import { Section } from "@/components/ui/Section";
import { EmptyState } from "@/components/ui/EmptyState";
import { SmartImage } from "@/components/ui/Media";
import { getSeriesList } from "@/lib/content";

export const metadata: Metadata = {
  title: "Series",
  description: "Browse sermon series from Kingdom Builders Christian Fellowship.",
};

export default async function SeriesListPage() {
  const series = await getSeriesList();

  return (
    <>
      <PageHeader eyebrow="Watch" title="Sermon series" intro="Catch a full teaching series from start to finish." />
      <Section>
        <Link href="/watch#archive" className="mb-8 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2">
          <ArrowLeft size={16} aria-hidden /> Back to Watch
        </Link>
        {series.length === 0 ? (
          <EmptyState title="No series yet" body="Add a series in the CMS." />
        ) : (
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {series.map((s) => (
              <Link key={s._id} href={`/watch/series/${s.slug}`} className="group block">
                <SmartImage image={s.image || { alt: s.title, placeholder: true }} />
                <h2 className="mt-3 font-display text-xl font-semibold group-hover:text-primary">{s.title}</h2>
                {s.description && <p className="mt-1 text-sm text-muted">{s.description}</p>}
              </Link>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
