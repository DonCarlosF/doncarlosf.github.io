import type { Metadata } from "next";
import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { PageHeader } from "@/components/blocks/PageHeader";
import { Section } from "@/components/ui/Section";
import { SermonCard } from "@/components/watch/SermonCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { search } from "@/lib/content";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Search",
  description: "Search sermons and articles from Kingdom Builders Christian Fellowship.",
};

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.trim();
  const results = term ? await search(term) : { sermons: [], posts: [] };
  const total = results.sermons.length + results.posts.length;

  return (
    <>
      <PageHeader eyebrow="Search" title="Find a message or article" intro="Search across sermons and the blog by topic, speaker, or scripture." />
      <Section>
        <form action="/search" method="get" role="search" className="flex max-w-xl gap-2">
          <label htmlFor="q" className="sr-only">Search</label>
          <div className="relative flex-1">
            <SearchIcon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id="q"
              name="q"
              defaultValue={term}
              placeholder="Try a topic, speaker, or scripture…"
              className="w-full rounded-btn border border-border bg-surface py-2.5 pl-10 pr-4 text-sm focus:outline-none focus-visible:outline-2 focus-visible:outline-ring"
            />
          </div>
          <button type="submit" className="rounded-btn bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg">Search</button>
        </form>

        {term && (
          <p className="mt-6 text-sm text-muted">{total} result{total === 1 ? "" : "s"} for &ldquo;{term}&rdquo;</p>
        )}

        {term && total === 0 && (
          <div className="mt-6"><EmptyState title="No matches" body="Try a different word, speaker, or scripture reference." /></div>
        )}

        {results.sermons.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-6 font-display text-xl font-semibold">Messages</h2>
            <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {results.sermons.map((s) => <SermonCard key={s._id} sermon={s} />)}
            </div>
          </div>
        )}

        {results.posts.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-6 font-display text-xl font-semibold">Articles</h2>
            <ul className="divide-y divide-border border-y border-border">
              {results.posts.map((p) => (
                <li key={p._id} className="py-4">
                  <Link href={`/blog/${p.slug}`} className="font-display text-lg font-semibold hover:text-primary">{p.title}</Link>
                  <p className="text-sm text-muted">{formatDate(p.date)}{p.category ? ` · ${p.category}` : ""}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </>
  );
}
