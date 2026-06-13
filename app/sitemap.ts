import type { MetadataRoute } from "next";
import { getSermons, getEvents, getBlogPosts } from "@/lib/content";

const base = process.env.NEXT_PUBLIC_SITE_URL || "https://kingdombuilders.example";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = ["", "/about", "/new-here", "/watch", "/give", "/events", "/groups", "/dream-center", "/blog", "/contact", "/search"];
  const now = new Date();

  const [sermons, events, posts] = await Promise.all([getSermons(), getEvents(), getBlogPosts()]);

  return [
    ...staticPaths.map((p) => ({ url: `${base}${p}`, lastModified: now, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...sermons.map((s) => ({ url: `${base}/watch/${s.slug}`, lastModified: new Date(s.date), changeFrequency: "monthly" as const, priority: 0.6 })),
    ...events.map((e) => ({ url: `${base}/events/${e.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: new Date(p.date), changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
