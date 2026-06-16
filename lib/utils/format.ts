import type { ServiceTime } from "@/lib/content/types";

const DAY = { weekday: "short", month: "short", day: "numeric" } as const;

/** "Worship 9:00 AM" — or just the label when a service has no fixed time. */
export function serviceLabelTime(s: ServiceTime): string {
  return s.time ? `${s.label} ${s.time}` : s.label;
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatEventDate(iso: string, allDay?: boolean): string {
  try {
    const d = new Date(iso);
    const date = new Intl.DateTimeFormat("en-US", DAY).format(d);
    if (allDay) return date;
    const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(d);
    return `${date} · ${time}`;
  } catch {
    return iso;
  }
}
