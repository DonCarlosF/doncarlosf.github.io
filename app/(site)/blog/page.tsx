import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/blocks/PageHeader";
import { Section } from "@/components/ui/Section";
import { EmptyState } from "@/components/ui/EmptyState";
import { SmartImage } from "@/components/ui/Media";
import { getBlogPosts } from "@/lib/content";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = {
  title: "Blog",
  description: "Encouragement, updates, and teaching from Kingdom Builders Christian Fellowship.",
};

export default async function BlogPage() {
  const posts = await getBlogPosts();

  return (
    <>
      <PageHeader eyebrow="Blog" title="Words for the journey." intro="Encouragement, teaching, and what God is doing at KBCF." />
      <Section>
        {posts.length === 0 ? (
          <EmptyState title="No posts yet" body="Publish your first article in the CMS." />
        ) : (
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <article key={p._id}>
                <Link href={`/blog/${p.slug}`} className="group block">
                  <SmartImage image={p.coverImage || { alt: p.title, placeholder: true }} ratio="aspect-[16/10]" />
                  <p className="mt-3 text-xs uppercase tracking-wide text-muted">
                    {formatDate(p.date)}{p.category ? ` · ${p.category}` : ""}
                  </p>
                  <h2 className="mt-1 font-display text-xl font-semibold leading-snug group-hover:text-primary">{p.title}</h2>
                  {p.excerpt && <p className="mt-2 text-sm text-muted">{p.excerpt}</p>}
                </Link>
              </article>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
