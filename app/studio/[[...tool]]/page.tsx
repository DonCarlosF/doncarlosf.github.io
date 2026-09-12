import type { Metadata, Viewport } from "next";
import { metadata as studioMetadata, viewport as studioViewport } from "next-sanity/studio";
import Studio from "@/components/studio/Studio";
import { isSanityConfigured } from "@/sanity/env";

export const dynamic = "force-static";

// next-sanity's defaults: noindex + same-origin referrer (Studio auth relies on it)
// and viewportFit=cover so the editor isn't clipped by phone notches.
export const metadata: Metadata = { ...studioMetadata, title: "Content Studio" };
export const viewport: Viewport = studioViewport;

export default function StudioPage() {
  if (!isSanityConfigured) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Content Studio</p>
        <h1 className="font-display text-3xl font-semibold">Connect Sanity to enable editing</h1>
        <p className="text-muted">
          The full content editor (sermons, events, blog, leadership, groups, homepage) mounts here once a Sanity
          project is connected. Until then the site renders from seeded content.
        </p>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
          <li>Create a free project at <code>sanity.io</code> (or run <code>npx sanity init</code>).</li>
          <li>
            Set <code>NEXT_PUBLIC_SANITY_PROJECT_ID</code> and <code>NEXT_PUBLIC_SANITY_DATASET</code> in your
            environment (and on Vercel).
          </li>
          <li>Redeploy — this page becomes the live Studio at <code>/studio</code>.</li>
        </ol>
      </main>
    );
  }
  return <Studio />;
}
