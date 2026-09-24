/**
 * Unified content API. Every page/component imports from here and never cares
 * whether data came from Sanity or the local seed.
 *
 *   Sanity configured?  -> live CMS content (ISR, on-demand revalidation)
 *   Otherwise           -> local seed (known KBCF facts + clearly-flagged samples)
 */
import "server-only";
import { sanityClient } from "./client";
import * as seed from "./seed";
import * as q from "./queries";
import { localOr } from "./local-images";
import { isUpcoming, nextOccurrenceIso } from "@/lib/utils/recurrence";
import type {
  SiteSettings, Sermon, ChurchEvent, Group, Leader, BlogPost, Testimonial, Clip, Series,
  HomeContent, AboutContent, OutreachProgram,
} from "./types";

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

/** All events — CMS-native (KBCF does not use Planning Center). */
export async function getEvents(): Promise<ChurchEvent[]> {
  const cms = (await sfetch<ChurchEvent[]>(q.eventsQuery)) ?? [];
  return nonEmpty(cms) ? cms : seed.events;
}

/**
 * Upcoming events, soonest first.
 * Weekly gatherings (a recurrence string) roll forward in America/Los_Angeles.
 * One-off events drop off 12 hours after they start. Past events are not
 * shown as upcoming just because nothing else is on the calendar.
 */
export async function getUpcomingEventsAll(now = new Date()): Promise<ChurchEvent[]> {
  const all = await getEvents();
  return all
    .filter((e) => isUpcoming(e, now))
    .map((e) => ({ ...e, nextStart: nextOccurrenceIso(e, now) }))
    .sort((a, b) => (a.nextStart ?? a.start).localeCompare(b.nextStart ?? b.start));
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
  return nonEmpty(cms) ? cms : seed.groups;
}

/** Well-known local photo names for the seeded leaders; other leaders fall back
 *  to a slug of their name (e.g. "Dr. Karen Jennings" -> dr-karen-jennings.jpg). */
const LEADER_LOCAL_IMG: Record<string, string> = { "ldr-lj": "pastor-lj", "ldr-karen": "pastor-karen" };
const nameSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function getLeaders(): Promise<Leader[]> {
  const data = await sfetch<Leader[]>(q.leadersQuery);
  const leaders = nonEmpty(data) ? data : seed.leaders;
  return leaders.map((l) =>
    l.image?.src
      ? l
      : { ...l, image: localOr(LEADER_LOCAL_IMG[l._id] ?? nameSlug(l.name), l.image ?? { alt: l.name, placeholder: true }) }
  );
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

/** Merge a CMS doc over seed defaults, dropping null/undefined/empty-array
 *  fields — so a half-filled Studio document never blanks or crashes a page. */
function withSeedDefaults<T extends object>(fallback: T, data: Partial<T> | null): T {
  if (!data) return { ...fallback };
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v != null && !(Array.isArray(v) && v.length === 0))
  );
  return { ...fallback, ...clean } as T;
}

/** Home page content (CMS singleton, seed fallback per-field). */
export async function getHomePage(): Promise<HomeContent> {
  const home = withSeedDefaults(seed.homePage, await sfetch<HomeContent>(q.homePageQuery));
  // No CMS photo yet? Pick up public/images/pastors.* if the file exists.
  if (!home.pastorsImage?.src) {
    home.pastorsImage = localOr("pastors", home.pastorsImage ?? { alt: "Pastors LJ & Karen Jennings", placeholder: true });
  }
  return home;
}

export async function getAboutPage(): Promise<AboutContent> {
  return withSeedDefaults(seed.aboutPage, await sfetch<AboutContent>(q.aboutPageQuery));
}

export const dreamCenter = seed.dreamCenter;

export async function getOutreachPrograms(): Promise<OutreachProgram[]> {
  const data = await sfetch<OutreachProgram[]>(q.outreachProgramsQuery);
  return nonEmpty(data) ? data : seed.outreachPrograms;
}

/** Lightweight search across sermons, blog, events, and groups. */
export async function search(term: string) {
  const t = term.trim().toLowerCase();
  if (!t) return { sermons: [], posts: [], events: [], groups: [] };
  const [sermons, posts, events, groups] = await Promise.all([
    getSermons(), getBlogPosts(), getEvents(), getGroups(),
  ]);
  const hay = (parts: Array<string | undefined>) => parts.filter(Boolean).join(" ").toLowerCase().includes(t);
  return {
    sermons: sermons.filter((s) =>
      hay([s.title, s.description, s.series?.title, s.speaker?.name, ...(s.scriptureRefs ?? [])])
    ),
    posts: posts.filter((p) => hay([p.title, p.excerpt, p.category, p.author?.name])),
    events: events.filter((e) => hay([e.title, e.description, e.location, e.recurrence])),
    groups: groups.filter((g) => hay([g.name, g.description, g.type, g.location, g.schedule, g.leaderName, g.semester])),
  };
}
