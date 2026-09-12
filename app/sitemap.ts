import type { MetadataRoute } from "next";
import { getSermons, getEvents, getBlogPosts, getSeriesList } from "@/lib/content";
import { siteUrl as base } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = ["", "/about", "/new-here", "/watch", "/watch/series", "/give", "/events", "/groups", "/dream-center", "/blog", "/contact"];
  const now = new Date();

  const [sermons, events, posts, series] = await Promise.all([getSermons(), getEvents(), getBlogPosts(), getSeriesList()]);
  // Seeded placeholders stay out of the sitemap (inert once Sanity is the source).
  const live = <T extends { sample?: boolean }>(xs: T[]) => xs.filter((x) => !x.sample);

  return [
    ...staticPaths.map((p) => ({ url: `${base}${p}`, lastModified: now, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...live(sermons).map((s) => ({ url: `${base}/watch/${s.slug}`, lastModified: new Date(s.date), changeFrequency: "monthly" as const, priority: 0.6 })),
    ...series.map((s) => ({ url: `${base}/watch/series/${s.slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: 0.5 })),
    ...live(events).map((e) => ({ url: `${base}/events/${e.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...live(posts).map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: new Date(p.date), changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
