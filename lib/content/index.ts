/**
 * Unified content API. Every page/component imports from here and never cares
 * whether data came from Sanity or the local seed.
 *
 *   Sanity configured?  -> live CMS content (ISR + tag-based on-demand revalidation)
 *   Otherwise           -> local seed (known KBCF facts + clearly-flagged samples)
 *
 * Once Sanity is connected it is the single source of truth: an empty collection
 * renders empty, it never resurrects seeded samples.
 */
import "server-only";
import { sanityClient } from "./client";
import * as seed from "./seed";
import * as q from "./queries";
import { localOr } from "./local-images";
import type {
  SiteSettings, Sermon, ChurchEvent, Group, Leader, BlogPost, Testimonial, Clip, Series,
  HomeContent, AboutContent, OutreachProgram,
} from "./types";

/** ISR window for Sanity queries; publishes reach the site sooner via /api/revalidate. */
const REVALIDATE = 300;
/** Cache tag on every Sanity query; /api/revalidate expires it on publish. */
export const SANITY_TAG = "sanity";

/** undefined = no Sanity (or the query failed) → use the seed; null / [] = Sanity's real answer. */
async function sfetch<T>(query: string, params: Record<string, unknown> = {}): Promise<T | null | undefined> {
  if (!sanityClient) return undefined;
  try {
    return await sanityClient.fetch<T>(query, params, { next: { revalidate: REVALIDATE, tags: [SANITY_TAG] } });
  } catch (err) {
    console.error(`[content] Sanity query failed (${query.slice(0, 60).replace(/\s+/g, " ")}…); using seed fallback:`, err);
    // Set CONTENT_STRICT=1 once the CMS is live so a broken query fails the build/regeneration
    // instead of quietly shipping sample content (ISR keeps serving the last good page).
    if (process.env.CONTENT_STRICT === "1") throw err;
    return undefined;
  }
}

/** Seed only when Sanity is absent; once connected, Sanity's answer (even empty) wins. */
function or<T>(cms: T | null | undefined, seedValue: T, empty: T): T {
  return cms === undefined ? seedValue : (cms ?? empty);
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const data = await sfetch<Partial<SiteSettings>>(q.siteSettingsQuery);
  if (!data) return seed.siteSettings;
  // Per-field fallback: a half-filled Site Settings document must never blank
  // or crash the layout (Footer, JSON-LD and the service bar dereference these).
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null));
  return {
    ...seed.siteSettings,
    ...clean,
    address: { ...seed.siteSettings.address, ...(data.address ?? {}) },
  } as SiteSettings;
}

export async function getSermons(): Promise<Sermon[]> {
  return or(await sfetch<Sermon[]>(q.sermonsQuery), seed.sermons, []);
}

export async function getLatestSermon(): Promise<Sermon | null> {
  return or(await sfetch<Sermon | null>(q.latestSermonQuery), seed.sermons[0] ?? null, null);
}

export async function getSermon(slug: string): Promise<Sermon | null> {
  return or(await sfetch<Sermon | null>(q.sermonBySlugQuery, { slug }), seed.sermons.find((s) => s.slug === slug) ?? null, null);
}

export async function getClips(): Promise<Clip[]> {
  return or(await sfetch<Clip[]>(q.clipsQuery), seed.sermons.flatMap((s) => s.clips ?? []), []);
}

export async function getSeriesList(): Promise<Series[]> {
  return or(await sfetch<Series[]>(q.seriesListQuery), seed.seriesList, []);
}

export async function getSeries(slug: string): Promise<{ series: Series; sermons: Sermon[] } | null> {
  const [series, sermons] = await Promise.all([
    sfetch<Series | null>(q.seriesBySlugQuery, { slug }),
    sfetch<Sermon[]>(q.sermonsBySeriesQuery, { slug }),
  ]);
  if (series !== undefined) return series ? { series, sermons: sermons ?? [] } : null;
  const seeded = seed.seriesList.find((s) => s.slug === slug);
  if (!seeded) return null;
  return { series: seeded, sermons: seed.sermons.filter((s) => s.series?._id === seeded._id) };
}

/** All events — CMS-native (KBCF does not use a third-party events platform). */
export async function getEvents(): Promise<ChurchEvent[]> {
  return or(await sfetch<ChurchEvent[]>(q.eventsQuery), seed.events, []);
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
  return or(await sfetch<Group[]>(q.groupsQuery), seed.groups, []);
}

/** Well-known local photo names for the seeded leaders (TS seed ids and the
 *  ids scripts/seed-sanity.mjs writes); other leaders fall back to a slug of
 *  their name (e.g. "Dr. Karen Jennings" -> dr-karen-jennings.jpg). */
const LEADER_LOCAL_IMG: Record<string, string> = {
  "ldr-lj": "pastor-lj", "ldr-karen": "pastor-karen",
  "leader.lj": "pastor-lj", "leader.karen": "pastor-karen",
};
const nameSlug = (n: string) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export async function getLeaders(): Promise<Leader[]> {
  const leaders = or(await sfetch<Leader[]>(q.leadersQuery), seed.leaders, []);
  return leaders.map((l) =>
    l.image?.src
      ? l
      : { ...l, image: localOr(LEADER_LOCAL_IMG[l._id] ?? nameSlug(l.name), l.image ?? { alt: l.name, placeholder: true }) }
  );
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  return or(await sfetch<BlogPost[]>(q.blogPostsQuery), seed.blogPosts, []);
}

export async function getBlogPost(slug: string): Promise<BlogPost | null> {
  return or(await sfetch<BlogPost | null>(q.blogPostBySlugQuery, { slug }), seed.blogPosts.find((p) => p.slug === slug) ?? null, null);
}

export async function getTestimonials(): Promise<Testimonial[]> {
  return or(await sfetch<Testimonial[]>(q.testimonialsQuery), seed.testimonials, []);
}

/** Merge a CMS doc over seed defaults, dropping null/undefined/empty-array
 *  fields — so a half-filled Studio document never blanks or crashes a page. */
function withSeedDefaults<T extends object>(fallback: T, data: Partial<T> | null | undefined): T {
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
  return or(await sfetch<OutreachProgram[]>(q.outreachProgramsQuery), seed.outreachPrograms, []);
}

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
