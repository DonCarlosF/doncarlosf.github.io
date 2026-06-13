import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { Section, Eyebrow } from "@/components/ui/Section";
import { SmartImage } from "@/components/ui/Media";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBlogPost, getBlogPosts } from "@/lib/content";
import { formatDate } from "@/lib/utils/format";

export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: "Post not found" };
  return { title: post.title, description: post.excerpt || post.title };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const portable = Array.isArray(post.body) ? (post.body as PortableTextBlock[]) : null;

  return (
    <Section>
      <article className="mx-auto max-w-2xl">
        <Link href="/blog" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2">
          <ArrowLeft size={16} aria-hidden /> All posts
        </Link>

        <Eyebrow className="mt-6">{formatDate(post.date)}{post.category ? ` · ${post.category}` : ""}</Eyebrow>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-tight">{post.title}</h1>
        {post.author?.name && <p className="mt-3 text-sm text-muted">By {post.author.name}</p>}

        <div className="my-8">
          <SmartImage image={post.coverImage || { alt: post.title, placeholder: true }} priority />
        </div>

        <div className="prose-kbcf space-y-4 text-lg leading-relaxed text-fg/90">
          {portable ? (
            <PortableText value={portable} />
          ) : (
            <p>{post.bodyText || post.excerpt}</p>
          )}
        </div>
      </article>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: post.title,
          datePublished: post.date,
          ...(post.author?.name ? { author: { "@type": "Person", name: post.author.name } } : {}),
          ...(post.excerpt ? { description: post.excerpt } : {}),
        }}
      />
    </Section>
  );
}
