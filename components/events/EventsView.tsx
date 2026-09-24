"use client";

import { useState } from "react";
import Link from "next/link";
import { MapPin, ArrowRight, Repeat, List, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatMonth, formatUpcomingWhen } from "@/lib/utils/format";
import { addCalendarDays, daysInMonth, occursOnLocalDay, weekdayOf, zonedParts } from "@/lib/utils/recurrence";
import type { ChurchEvent } from "@/lib/content/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ListView({ events, now }: { events: ChurchEvent[]; now: Date }) {
  const groups = new Map<string, ChurchEvent[]>();
  for (const event of events) {
    const key = formatMonth(event.nextStart ?? event.start);
    groups.set(key, [...(groups.get(key) || []), event]);
  }
  return (
    <div className="space-y-12">
      {[...groups.entries()].map(([month, list]) => (
        <div key={month}>
          <h2 className="mb-5 font-display text-2xl font-semibold">{month}</h2>
          <ul className="divide-y divide-border border-y border-border">
            {list.map((event) => (
              <li key={event._id} className="group flex flex-wrap items-center gap-4 py-5">
                <div className="min-w-0 flex-1">
                  <Link href={`/events/${event.slug}`} className="font-display text-lg font-semibold hover:text-primary">{event.title}</Link>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                    <span className="inline-flex items-center gap-1">
                      {event.recurrence ? <Repeat size={14} aria-hidden /> : null}
                      {formatUpcomingWhen(event, now)}
                    </span>
                    {event.location && <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden /> {event.location}</span>}
                  </p>
                </div>
                <Link href={`/events/${event.slug}`} aria-label={`Details for ${event.title}`} className="text-muted transition-all duration-200 group-hover:translate-x-1 group-hover:text-primary">
                  <ArrowRight size={18} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function CalendarView({ events, todayIso }: { events: ChurchEvent[]; todayIso: string }) {
  const today = zonedParts(new Date(todayIso));
  const [cursor, setCursor] = useState({ y: today.year, m: today.month });

  const firstWeekday = weekdayOf(cursor.y, cursor.m, 1);
  const count = daysInMonth(cursor.y, cursor.m);
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(cursor.y, cursor.m - 1, 1)),
  );

  const shift = (delta: number) => setCursor(({ y, m }) => {
    const next = delta < 0
      ? addCalendarDays(y, m, 1, -1)
      : addCalendarDays(y, m, daysInMonth(y, m), 1);
    return { y: next.year, m: next.month };
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">{monthLabel}</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="rounded-btn border border-border p-2 hover:bg-surface-2"><ChevronLeft size={18} aria-hidden /></button>
          <button type="button" onClick={() => shift(1)} aria-label="Next month" className="rounded-btn border border-border p-2 hover:bg-surface-2"><ChevronRight size={18} aria-hidden /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-card border border-border bg-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-surface-2 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">
            <span className="hidden sm:inline">{d}</span><span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
        {cells.map((day, i) => {
          const dayEvents = day ? events.filter((event) => occursOnLocalDay(event, cursor.y, cursor.m, day)) : [];
          const isToday = day === today.day && cursor.y === today.year && cursor.m === today.month;
          return (
            <div key={i} className={cn("min-h-20 bg-surface p-1.5 sm:min-h-28", !day && "bg-surface/40")}>
              {day && (
                <>
                  <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", isToday ? "bg-primary font-bold text-primary-fg" : "text-muted")}>{day}</span>
                  <ul className="mt-1 space-y-1">
                    {dayEvents.map((event) => (
                      <li key={event._id}>
                        <Link href={`/events/${event.slug}`} className="block truncate rounded bg-accent/20 px-1.5 py-0.5 text-[11px] font-medium text-fg hover:bg-accent/40" title={event.title}>
                          {event.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EventsView({ events, todayIso }: { events: ChurchEvent[]; todayIso: string }) {
  const [view, setView] = useState<"list" | "calendar">("list");
  return (
    <div>
      <div role="group" aria-label="Event view" className="mb-8 inline-flex rounded-btn border border-border p-1">
        {([["list", List, "List"], ["calendar", CalendarDays, "Calendar"]] as const).map(([v, Icon, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={cn("inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-sm font-semibold", view === v ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")}
          >
            <Icon size={15} aria-hidden /> {label}
          </button>
        ))}
      </div>
      {view === "list" ? <ListView events={events} now={new Date(todayIso)} /> : <CalendarView events={events} todayIso={todayIso} />}
    </div>
  );
}
