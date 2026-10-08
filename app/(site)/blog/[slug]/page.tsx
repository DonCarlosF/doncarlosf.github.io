import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { PortableText, type PortableTextBlock, type PortableTextComponents } from "@portabletext/react";
import { Section, Eyebrow } from "@/components/ui/Section";
import { SmartImage } from "@/components/ui/Media";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBlogPost, getBlogPosts } from "@/lib/content";
import { formatDate } from "@/lib/utils/format";
import { siteUrl } from "@/lib/site-url";

export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: "Post not found" };
  const image = post.coverImage?.src && !post.coverImage.placeholder ? post.coverImage.src : undefined;
  return {
    title: post.title,
    description: post.excerpt || post.title,
    openGraph: { type: "article", publishedTime: post.date, ...(image ? { images: [image] } : {}) },
    // Seeded placeholders must never be indexed if DNS moves before the CMS is live.
    ...(post.sample ? { robots: { index: false, follow: false } } : {}),
  };
}

/** Body renderers: inline images (projected to { src, alt } in GROQ) and safe links. */
const components: PortableTextComponents = {
  types: {
    accessibleImage: ({ value }: { value: { src?: string; alt?: string } }) =>
      value?.src ? (
        <Image
          src={value.src}
          alt={value.alt ?? ""}
          width={1200}
          height={800}
          sizes="(max-width: 768px) 100vw, 672px"
          className="h-auto w-full rounded-card"
        />
      ) : null,
  },
  marks: {
    link: ({ value, children }) => {
      const raw = typeof value?.href === "string" ? value.href : "";
      const href = /^(https?:\/\/|mailto:|tel:|\/|#)/.test(raw) ? raw : "#";
      const external = /^https?:\/\//.test(href);
      return (
        <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
          {children}
        </a>
      );
    },
  },
};

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const portable = Array.isArray(post.body) ? (post.body as PortableTextBlock[]) : null;
  const coverUrl = post.coverImage?.src && !post.coverImage.placeholder ? post.coverImage.src : null;

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
          <SmartImage image={post.coverImage || { alt: post.title, placeholder: true }} preload sizes="(min-width: 768px) 672px, 100vw" />
        </div>

        <div className="prose-kbcf space-y-4 text-lg leading-relaxed text-fg/90">
          {portable ? (
            <PortableText value={portable} components={components} />
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
          mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
          publisher: { "@type": "Organization", name: "Kingdom Builders Christian Fellowship" },
          ...(coverUrl ? { image: [coverUrl] } : {}),
          ...(post.author?.name ? { author: { "@type": "Person", name: post.author.name } } : {}),
          ...(post.excerpt ? { description: post.excerpt } : {}),
        }}
      />
    </Section>
  );
}
