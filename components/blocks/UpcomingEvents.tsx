import Link from "next/link";
import { CalendarDays, ArrowRight } from "lucide-react";
import { Section, SectionHeading } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { formatEventDate } from "@/lib/utils/format";
import type { ChurchEvent } from "@/lib/content/types";

export function UpcomingEvents({ events }: { events: ChurchEvent[] }) {
  if (!events.length) return null;
  return (
    <Section id="events">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionHeading eyebrow="What's coming up" title="Upcoming events" />
        <Button href="/events" variant="outline" size="sm">All events</Button>
      </div>

      <ul className="mt-8 divide-y divide-border border-y border-border">
        {events.map((e) => (
          <li key={e._id}>
            <Reveal>
              <Link href={`/events/${e.slug}`} className="flex flex-wrap items-center gap-4 py-5 transition-colors hover:bg-surface-2/60">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2 text-primary" aria-hidden>
                  <CalendarDays size={22} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-semibold">{e.title}</span>
                  <span className="block text-sm text-muted">
                    {e.recurrence || formatEventDate(e.start, e.allDay)}{e.location ? ` · ${e.location}` : ""}
                  </span>
                </span>
                <ArrowRight size={18} className="text-muted" aria-hidden />
              </Link>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
