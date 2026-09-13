/**
 * Every HTML route the production build emits (seed content, no Sanity).
 * Dynamic slugs come from lib/content/seed.ts. /studio is handled separately
 * (heavy client-only app — see smoke.spec.ts).
 */
export const HTML_ROUTES = [
  "/",
  "/about",
  "/new-here",
  "/watch",
  "/watch/sample-message-1",
  "/watch/sample-message-2",
  "/watch/series",
  "/watch/series/sample-series",
  "/give",
  "/events",
  "/events/saturday-morning-prayer",
  "/events/sunday-worship",
  "/events/wednesday-bible-study",
  "/events/sample-event",
  "/groups",
  "/dream-center",
  "/blog",
  "/blog/sample-post",
  "/contact",
  "/search",
  "/search?q=sample",
] as const;

/** Paths that must appear as <loc> entries in /sitemap.xml. */
export const SITEMAP_PATHS = [
  "",
  "/about",
  "/new-here",
  "/watch",
  "/watch/series",
  "/give",
  "/events",
  "/groups",
  "/dream-center",
  "/blog",
  "/contact",
  "/watch/series/sample-series",
  "/events/sunday-worship",
] as const;

/** Seeded placeholder content and internal search results must NOT be in the sitemap. */
export const SITEMAP_EXCLUDED = ["/watch/sample-message-1", "/blog/sample-post", "/events/sample-event", "/search"] as const;

/**
 * Third-party hosts the site may reach out to (analytics, video, maps, fonts).
 * Their failures are not ours to assert on — they are ignored in the smoke
 * tests so the suite stays deterministic offline.
 */
export const THIRD_PARTY_HOSTS = [
  "plausible.io",
  "boxcast.com",
  "youtube.com",
  "youtube-nocookie.com",
  "ytimg.com",
  "google.com",
  "googleapis.com",
  "gstatic.com",
  "clover.com",
  "cloverdonations.com",
  "sanity.io",
] as const;
