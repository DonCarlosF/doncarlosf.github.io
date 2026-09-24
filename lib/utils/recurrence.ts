/**
 * Weekly recurrence for church events, evaluated in America/Los_Angeles.
 *
 * CMS events store one anchor `start` plus an optional human `recurrence`
 * string ("Every Sunday · 9:00 AM"). The anchor is not a forever date: once
 * it passes, weekly gatherings still happen. All clock math uses the church
 * timezone so a UTC server and a Pacific visitor agree on the weekday.
 */

export const CHURCH_TZ = "America/Los_Angeles";

/** Keep a gathering on the upcoming list until 12 hours after it starts. */
export const UPCOMING_GRACE_MS = 12 * 60 * 60 * 1000;

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

const SCHEMA_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

export function zonedParts(date: Date, timeZone = CHURCH_TZ): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  let hour = Number(bag.hour);
  if (hour === 24) hour = 0;
  let second = Number(bag.second);
  if (!Number.isFinite(second)) second = 0;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second,
    weekday: WEEKDAY_INDEX[bag.weekday.slice(0, 3)] ?? 0,
  };
}

function offsetMs(instant: Date, timeZone: string): number {
  const parts = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - instant.getTime();
}

/** Wall-clock time in `timeZone` → UTC instant. */
export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone = CHURCH_TZ,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let offset = offsetMs(new Date(utcGuess), timeZone);
  let instant = utcGuess - offset;
  offset = offsetMs(new Date(instant), timeZone);
  instant = utcGuess - offset;
  return new Date(instant);
}

export function addCalendarDays(year: number, month: number, day: number, days: number) {
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

export function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

type Timed = { start: string; recurrence?: string };

function hasRecurrence(event: Timed): boolean {
  return Boolean(event.recurrence?.trim());
}

/** Next weekly instant at the anchor's local weekday and time, honoring grace. */
export function nextWeeklyOccurrence(startIso: string, now = new Date()): Date {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return new Date(NaN);
  const pattern = zonedParts(start);
  const earliestMs = Math.max(start.getTime(), now.getTime() - UPCOMING_GRACE_MS);
  const floor = zonedParts(new Date(earliestMs));

  for (let i = 0; i < 8; i++) {
    const day = addCalendarDays(floor.year, floor.month, floor.day, i);
    if (weekdayOf(day.year, day.month, day.day) !== pattern.weekday) continue;
    const instant = zonedLocalToUtc(day.year, day.month, day.day, pattern.hour, pattern.minute);
    if (instant.getTime() + UPCOMING_GRACE_MS < now.getTime()) continue;
    if (instant.getTime() + 60_000 < start.getTime()) continue;
    return instant;
  }
  return start;
}

export function nextOccurrenceIso(event: Timed, now = new Date()): string {
  if (!hasRecurrence(event)) return event.start;
  const next = nextWeeklyOccurrence(event.start, now);
  return Number.isNaN(next.getTime()) ? event.start : next.toISOString();
}

/** Recurring gatherings stay upcoming; one-off events drop off after the grace window. */
export function isUpcoming(event: Timed, now = new Date()): boolean {
  if (hasRecurrence(event)) return true;
  const start = new Date(event.start).getTime();
  if (Number.isNaN(start)) return false;
  return start >= now.getTime() - UPCOMING_GRACE_MS;
}

/** Whether this event occupies a church-local calendar day. */
export function occursOnLocalDay(event: Timed, year: number, month: number, day: number): boolean {
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return false;
  if (!hasRecurrence(event)) {
    const parts = zonedParts(start);
    return parts.year === year && parts.month === month && parts.day === day;
  }
  const pattern = zonedParts(start);
  if (weekdayOf(year, month, day) !== pattern.weekday) return false;
  const instant = zonedLocalToUtc(year, month, day, pattern.hour, pattern.minute);
  return instant.getTime() + 60_000 >= start.getTime();
}

/** Schema.org Schedule for a weekly gathering. Clock time is the anchor's local time. */
export function weeklyScheduleLd(startIso: string) {
  const parts = zonedParts(new Date(startIso));
  const hh = String(parts.hour).padStart(2, "0");
  const mm = String(parts.minute).padStart(2, "0");
  return {
    "@type": "Schedule",
    repeatFrequency: "P1W",
    byDay: `https://schema.org/${SCHEMA_DAYS[parts.weekday]}`,
    startTime: `${hh}:${mm}`,
    scheduleTimezone: CHURCH_TZ,
  };
}
