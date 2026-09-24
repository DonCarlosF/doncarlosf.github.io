import type { ServiceTime } from "@/lib/content/types";
import { CHURCH_TZ } from "@/lib/utils/recurrence";

const DAY = { weekday: "short", month: "short", day: "numeric", timeZone: CHURCH_TZ } as const;

/** "Worship 9:00 AM" — or just the label when a service has no fixed time. */
export function serviceLabelTime(s: ServiceTime): string {
  return s.time ? `${s.label} ${s.time}` : s.label;
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric", timeZone: CHURCH_TZ,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** Month heading for a church-local calendar, e.g. "September 2026". */
export function formatMonth(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "long", year: "numeric", timeZone: CHURCH_TZ,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatEventDate(iso: string, allDay?: boolean): string {
  try {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat("en-US", DAY).format(d);
    if (allDay) return date;
    const time = new Intl.DateTimeFormat("en-US", {
      hour: "numeric", minute: "2-digit", timeZone: CHURCH_TZ,
    }).format(d);
    return `${date} · ${time}`;
  } catch {
    return iso;
  }
}

/** Recurrence label plus the next church-local date. "Next" is omitted once that time has passed. */
export function formatUpcomingWhen(
  event: { recurrence?: string; start: string; nextStart?: string; allDay?: boolean },
  now: Date = new Date(),
): string {
  const iso = event.nextStart ?? event.start;
  if (!event.recurrence) return formatEventDate(iso, event.allDay);
  const stamp = formatEventDate(iso, event.allDay);
  const prefix = new Date(iso).getTime() < now.getTime() ? "" : "Next ";
  return `${event.recurrence} · ${prefix}${stamp}`;
}

/** `tel:` href for a displayed US number. */
export function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `tel:+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `tel:+${digits}`;
  return `tel:+${digits}`;
}
