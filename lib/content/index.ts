/**
 * Unified content API. Every page/component imports from here and never cares
 * whether data came from Sanity, Planning Center, or the local seed.
 *
 *   Sanity configured?  -> live CMS content (ISR, on-demand revalidation)
 *   Planning Center?     -> live events/groups merged in
 *   Neither?             -> local seed (known KBCF facts + clearly-flagged samples)
 */
import "server-only";
import { sanityClient } from "./client";
import * as seed from "./seed";
import * as q from "./queries";
import type {
  SiteSettings, Sermon, ChurchEvent, Group, Leader, BlogPost, Testimonial, Clip, Series,
  HomeContent, AboutContent,
} from "./types";
import {
  getPlanningCenterEvents, getPlanningCenterGroups, isPlanningCenterConfigured,
} from "@/lib/integrations/planningcenter";

const REVALIDATE = 60;

async function sfetch<T>(query: string, params: Record<string, unknown> = {}): Promise<T | null> {
  if (!sanityClient) return null;
  try {
    return await sanityClient.fetch<T>(query, params, { next: { revalidate: REVALIDATE } });
  } catch {
    return null;
  }
}

function nonEmpty<T>(v: T[] | null | undefined): v is T[] {
  return Array.isArray(v) && v.length > 0;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return (await sfetch<SiteSettings>(q.siteSettingsQuery)) ?? seed.siteSettings;
}

export async function getSermons(): Promise<Sermon[]> {
  const data = await sfetch<Sermon[]>(q.sermonsQuery);
  return nonEmpty(data) ? data : seed.sermons;
}

export async function getLatestSermon(): Promise<Sermon | null> {
  const data = await sfetch<Sermon>(q.latestSermonQuery);
  return data ?? seed.sermons[0] ?? null;
}

export async function getSermon(slug: string): Promise<Sermon | null> {
  const data = await sfetch<Sermon>(q.sermonBySlugQuery, { slug });
  return data ?? seed.sermons.find((s) => s.slug === slug) ?? null;
}

export async function getClips(): Promise<Clip[]> {
  const data = await sfetch<Clip[]>(q.clipsQuery);
  if (nonEmpty(data)) return data;
  return seed.sermons.flatMap((s) => s.clips ?? []);
}

export async function getSeriesList(): Promise<Series[]> {
  const data = await sfetch<Series[]>(q.seriesListQuery);
  return nonEmpty(data) ? data : seed.seriesList;
}

export async function getSeries(slug: string): Promise<{ series: Series; sermons: Sermon[] } | null> {
  if (sanityClient) {
    const series = await sfetch<Series>(q.seriesBySlugQuery, { slug });
    if (series) {
      const sermons = (await sfetch<Sermon[]>(q.sermonsBySeriesQuery, { slug })) ?? [];
      return { series, sermons };
    }
  }
  const series = seed.seriesList.find((s) => s.slug === slug);
  if (!series) return null;
  const sermons = seed.sermons.filter((s) => s.series?._id === series._id);
  return { series, sermons };
}

/** All events (CMS/seed) merged with Planning Center when configured. */
export async function getEvents(): Promise<ChurchEvent[]> {
  const cms = (await sfetch<ChurchEvent[]>(q.eventsQuery)) ?? [];
  const base = nonEmpty(cms) ? cms : seed.events;
  if (isPlanningCenterConfigured) {
    const pco = await getPlanningCenterEvents();
    return [...pco, ...base].sort((a, b) => a.start.localeCompare(b.start));
  }
  return base;
}

/** Upcoming events (sorted soonest-first), including ones happening today. */
export async function getUpcomingEventsAll(): Promise<ChurchEvent[]> {
  const cutoff = Date.now() - 1000 * 60 * 60 * 12;
  const all = await getEvents();
  const future = all
    .filter((e) => new Date(e.start).getTime() >= cutoff)
    .sort((a, b) => a.start.localeCompare(b.start));
  return future.length ? future : [...all].sort((a, b) => a.start.localeCompare(b.start));
}

export async function getUpcomingEvents(limit = 4): Promise<ChurchEvent[]> {
  return (await getUpcomingEventsAll()).slice(0, limit);
}

export async function getEvent(slug: string): Promise<ChurchEvent | null> {
  const all = await getEvents();
  return all.find((e) => e.slug === slug) ?? null;
}

export async function getGroups(): Promise<Group[]> {
  const cms = (await sfetch<Group[]>(q.groupsQuery)) ?? [];
  if (isPlanningCenterConfigured) {
    const pco = await getPlanningCenterGroups();
    if (nonEmpty(pco)) return pco;
  }
  return nonEmpty(cms) ? cms : seed.groups;
}

export async function getLeaders(): Promise<Leader[]> {
  const data = await sfetch<Leader[]>(q.leadersQuery);
  return nonEmpty(data) ? data : seed.leaders;
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  const data = await sfetch<BlogPost[]>(q.blogPostsQuery);
  return nonEmpty(data) ? data : seed.blogPosts;
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  const data = await sfetch<BlogPost>(q.blogPostBySlugQuery, { slug });
  return data ?? seed.blogPosts.find((p) => p.slug === slug) ?? null;
}

export async function getTestimonials(): Promise<Testimonial[]> {
  const data = await sfetch<Testimonial[]>(q.testimonialsQuery);
  return nonEmpty(data) ? data : seed.testimonials;
}

/** Home page content (CMS singleton, seed fallback). Falls back to seed if the
 *  doc is missing or any required block is absent, so the page never half-renders. */
export async function getHomePage(): Promise<HomeContent> {
  const data = await sfetch<HomeContent>(q.homePageQuery);
  return data && nonEmpty(data.heroSlides) ? data : seed.homePage;
}

export async function getAboutPage(): Promise<AboutContent> {
  const data = await sfetch<AboutContent>(q.aboutPageQuery);
  return data && data.intro ? data : seed.aboutPage;
}

export const dreamCenter = seed.dreamCenter;

/** Lightweight search across sermons + blog (title/description/excerpt). */
export async function search(term: string) {
  const t = term.trim().toLowerCase();
  if (!t) return { sermons: [], posts: [] };
  const [sermons, posts] = await Promise.all([getSermons(), getBlogPosts()]);
  const matchS = sermons.filter((s) =>
    [s.title, s.description, s.series?.title, s.speaker?.name, ...(s.scriptureRefs ?? [])]
      .filter(Boolean).join(" ").toLowerCase().includes(t)
  );
  const matchP = posts.filter((p) =>
    [p.title, p.excerpt, p.category, p.author?.name].filter(Boolean).join(" ").toLowerCase().includes(t)
  );
  return { sermons: matchS, posts: matchP };
}
