import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/blocks/PageHeader";
import { Section } from "@/components/ui/Section";
import { EmptyState } from "@/components/ui/EmptyState";
import { SermonCard } from "@/components/watch/SermonCard";
import { getSeries, getSeriesList } from "@/lib/content";

export async function generateStaticParams() {
  const series = await getSeriesList();
  return series.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getSeries(slug);
  if (!data) return { title: "Series not found" };
  return { title: data.series.title, description: data.series.description || `The ${data.series.title} series.` };
}

export default async function SeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getSeries(slug);
  if (!data) notFound();
  const { series, sermons } = data;

  return (
    <>
      <PageHeader eyebrow="Series" title={series.title} intro={series.description} />
      <Section>
        <Link href="/watch/series" className="mb-8 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2">
          <ArrowLeft size={16} aria-hidden /> All series
        </Link>
        {sermons.length === 0 ? (
          <EmptyState title="No messages in this series yet" body="Add sermons to this series in the CMS." />
        ) : (
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {sermons.map((s) => <SermonCard key={s._id} sermon={s} />)}
          </div>
        )}
      </Section>
    </>
  );
}
