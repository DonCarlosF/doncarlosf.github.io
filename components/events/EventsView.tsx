"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, ArrowRight, Repeat, List, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatEventDate } from "@/lib/utils/format";
import type { ChurchEvent } from "@/lib/content/types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function ListView({ events }: { events: ChurchEvent[] }) {
  const groups = new Map<string, ChurchEvent[]>();
  for (const e of events) {
    const k = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(e.start));
    groups.set(k, [...(groups.get(k) || []), e]);
  }
  return (
    <div className="space-y-12">
      {[...groups.entries()].map(([month, list]) => (
        <div key={month}>
          <h2 className="mb-5 font-display text-2xl font-semibold">{month}</h2>
          <ul className="divide-y divide-border border-y border-border">
            {list.map((e) => (
              <li key={e._id} className="flex flex-wrap items-center gap-4 py-5">
                <div className="min-w-0 flex-1">
                  <Link href={`/events/${e.slug}`} className="font-display text-lg font-semibold hover:text-primary">{e.title}</Link>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                    <span className="inline-flex items-center gap-1">
                      {e.recurrence ? <Repeat size={14} aria-hidden /> : null}
                      {e.recurrence || formatEventDate(e.start, e.allDay)}
                    </span>
                    {e.location && <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden /> {e.location}</span>}
                  </p>
                </div>
                <Link href={`/events/${e.slug}`} aria-label={`Details for ${e.title}`} className="text-muted hover:text-primary">
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

function CalendarView({ events }: { events: ChurchEvent[] }) {
  const first = events.length ? new Date(events[0].start) : new Date();
  const [cursor, setCursor] = useState({ y: first.getFullYear(), m: first.getMonth() });

  const byDay = useMemo(() => {
    const map = new Map<string, ChurchEvent[]>();
    for (const e of events) {
      const k = dayKey(new Date(e.start));
      map.set(k, [...(map.get(k) || []), e]);
    }
    return map;
  }, [events]);

  const firstOfMonth = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const offset = firstOfMonth.getDay();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const monthLabel = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(firstOfMonth);
  const today = new Date();

  const shift = (delta: number) => setCursor(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">{monthLabel}</h2>
        <div className="flex gap-2">
          <button onClick={() => shift(-1)} aria-label="Previous month" className="rounded-btn border border-border p-2 hover:bg-surface-2"><ChevronLeft size={18} aria-hidden /></button>
          <button onClick={() => shift(1)} aria-label="Next month" className="rounded-btn border border-border p-2 hover:bg-surface-2"><ChevronRight size={18} aria-hidden /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-card border border-border bg-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="bg-surface-2 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">
            <span className="hidden sm:inline">{d}</span><span className="sm:hidden">{d[0]}</span>
          </div>
        ))}
        {cells.map((day, i) => {
          const date = day ? new Date(cursor.y, cursor.m, day) : null;
          const dayEvents = date ? byDay.get(dayKey(date)) || [] : [];
          const isToday = date && dayKey(date) === dayKey(today);
          return (
            <div key={i} className={cn("min-h-20 bg-surface p-1.5 sm:min-h-28", !day && "bg-surface/40")}>
              {day && (
                <>
                  <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", isToday ? "bg-primary font-bold text-primary-fg" : "text-muted")}>{day}</span>
                  <ul className="mt-1 space-y-1">
                    {dayEvents.map((e) => (
                      <li key={e._id}>
                        <Link href={`/events/${e.slug}`} className="block truncate rounded bg-accent/20 px-1.5 py-0.5 text-[11px] font-medium text-fg hover:bg-accent/40" title={e.title}>
                          {e.title}
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

export function EventsView({ events }: { events: ChurchEvent[] }) {
  const [view, setView] = useState<"list" | "calendar">("list");
  return (
    <div>
      <div role="group" aria-label="Event view" className="mb-8 inline-flex rounded-btn border border-border p-1">
        {([["list", List, "List"], ["calendar", CalendarDays, "Calendar"]] as const).map(([v, Icon, label]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={cn("inline-flex items-center gap-1.5 rounded-[7px] px-3 py-1.5 text-sm font-semibold", view === v ? "bg-primary text-primary-fg" : "text-muted hover:text-fg")}
          >
            <Icon size={15} aria-hidden /> {label}
          </button>
        ))}
      </div>
      {view === "list" ? <ListView events={events} /> : <CalendarView events={events} />}
    </div>
  );
}
