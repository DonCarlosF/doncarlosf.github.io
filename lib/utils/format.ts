import type { ServiceTime } from "@/lib/content/types";

/**
 * KBCF is in Oakland. Every rendered date uses this zone so the server (UTC on
 * Vercel and CI) and the visitor's browser agree — otherwise event times drift
 * and client components hydrate with a different string than the server sent.
 */
export const CHURCH_TZ = "America/Los_Angeles";

const DAY = { weekday: "short", month: "short", day: "numeric", timeZone: CHURCH_TZ } as const;
const TIME = { hour: "numeric", minute: "2-digit", timeZone: CHURCH_TZ } as const;

/** "Worship 9:00 AM" — or just the label when a service has no fixed time. */
export function serviceLabelTime(s: ServiceTime): string {
  return s.time ? `${s.label} ${s.time}` : s.label;
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: CHURCH_TZ }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatEventDate(iso: string, allDay?: boolean): string {
  try {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat("en-US", DAY).format(d);
    if (allDay) return date;
    const time = new Intl.DateTimeFormat("en-US", TIME).format(d);
    return `${date} · ${time}`;
  } catch {
    return iso;
  }
}

/** "2026-07-04": the church-local calendar day of an instant. */
export function dayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CHURCH_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** "July 2026": the church-local month of an instant. */
export function monthLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: CHURCH_TZ }).format(d);
}

/** Church-local { y, m } (m is 0-based) of an instant, for calendar navigation. */
export function zonedYearMonth(d: Date): { y: number; m: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: CHURCH_TZ, year: "numeric", month: "numeric" }).formatToParts(d);
  const get = (t: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month") - 1 };
}
