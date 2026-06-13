/**
 * Planning Center adapter (Calendar + Groups).
 *
 * Reads credentials from env (PCO_APP_ID / PCO_SECRET — a Personal Access Token
 * pair from Planning Center → Developer). When credentials are absent or a
 * request fails, every function returns an empty result so callers fall back to
 * CMS/seed data. No credentials are bundled and nothing is fabricated.
 *
 * To go live: create a PAT at https://api.planningcenteronline.com/oauth/applications
 * and set PCO_APP_ID and PCO_SECRET in the environment.
 */
import type { ChurchEvent, Group } from "@/lib/content/types";

const APP_ID = process.env.PCO_APP_ID || "";
const SECRET = process.env.PCO_SECRET || "";
const BASE = "https://api.planningcenteronline.com";
const REVALIDATE = 300; // 5 min

export const isPlanningCenterConfigured = Boolean(APP_ID && SECRET);

async function pco<T = unknown>(path: string): Promise<T | null> {
  if (!isPlanningCenterConfigured) return null;
  try {
    const auth = Buffer.from(`${APP_ID}:${SECRET}`).toString("base64");
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Basic ${auth}` },
      next: { revalidate: REVALIDATE, tags: ["planningcenter"] },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type JsonApi = {
  data?: Array<{ id: string; attributes?: Record<string, unknown>; relationships?: Record<string, { data?: { id: string } }> }>;
  included?: Array<{ id: string; type: string; attributes?: Record<string, unknown> }>;
};

export async function getPlanningCenterEvents(): Promise<ChurchEvent[]> {
  const json = await pco<JsonApi>(
    "/calendar/v2/event_instances?filter=future&order=starts_at&include=event&per_page=25"
  );
  if (!json?.data) return [];
  const events = new Map<string, Record<string, unknown>>();
  (json.included || []).forEach((i) => { if (i.type === "Event") events.set(i.id, i.attributes || {}); });

  return json.data.map((inst) => {
    const a = inst.attributes || {};
    const eventId = inst.relationships?.event?.data?.id;
    const e = eventId ? events.get(eventId) || {} : {};
    const name = (e.name as string) || "Event";
    return {
      _id: `pco-${inst.id}`,
      title: name,
      slug: `pco-${inst.id}`,
      start: (a.starts_at as string) || new Date().toISOString(),
      end: (a.ends_at as string) || undefined,
      allDay: Boolean(a.all_day_event),
      location: (a.location as string) || undefined,
      description: (e.description as string) || undefined,
      registrationUrl: (e.registration_url as string) || undefined,
      image: e.image_url ? { src: e.image_url as string, alt: name } : undefined,
      source: "planningcenter" as const,
    };
  });
}

export async function getPlanningCenterGroups(): Promise<Group[]> {
  const json = await pco<JsonApi>("/groups/v2/groups?per_page=50&order=name");
  if (!json?.data) return [];
  return json.data.map((g) => {
    const a = g.attributes || {};
    const name = (a.name as string) || "Group";
    return {
      _id: `pco-${g.id}`,
      name,
      slug: `pco-${g.id}`,
      schedule: (a.schedule as string) || undefined,
      description: (a.description as string) || undefined,
      joinUrl: (a.public_church_center_web_url as string) || undefined,
      image: a.header_image && (a.header_image as Record<string, string>).original
        ? { src: (a.header_image as Record<string, string>).original, alt: name }
        : undefined,
    };
  });
}
