import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, ArrowRight, Repeat } from "lucide-react";
import { PageHeader } from "@/components/blocks/PageHeader";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getUpcomingEventsAll } from "@/lib/content";
import { formatEventDate } from "@/lib/utils/format";
import type { ChurchEvent } from "@/lib/content/types";

export const metadata: Metadata = {
  title: "Events",
  description: "Upcoming gatherings, services, and events at Kingdom Builders Christian Fellowship.",
};

function monthKey(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(iso));
}

export default async function EventsPage() {
  const upcoming = await getUpcomingEventsAll();

  // Group by month for a lightweight calendar-style view.
  const groups = new Map<string, ChurchEvent[]>();
  for (const e of upcoming) {
    const k = monthKey(e.start);
    groups.set(k, [...(groups.get(k) || []), e]);
  }

  return (
    <>
      <PageHeader
        eyebrow="Events"
        title="There's always something happening."
        intro="Worship, study, and community throughout the week. Find your next step below."
      />

      <Section>
        {upcoming.length === 0 ? (
          <EmptyState title="No upcoming events right now" body="Check back soon, or add events in the CMS / Planning Center." />
        ) : (
          <div className="space-y-12">
            {[...groups.entries()].map(([month, list]) => (
              <div key={month}>
                <h2 className="mb-5 font-display text-2xl font-semibold">{month}</h2>
                <ul className="divide-y divide-border border-y border-border">
                  {list.map((e) => (
                    <li key={e._id} className="flex flex-wrap items-center gap-4 py-5">
                      <div className="min-w-0 flex-1">
                        <Link href={`/events/${e.slug}`} className="font-display text-lg font-semibold hover:text-primary">
                          {e.title}
                        </Link>
                        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
                          <span className="inline-flex items-center gap-1">
                            {e.recurrence ? <Repeat size={14} aria-hidden /> : null}
                            {e.recurrence || formatEventDate(e.start, e.allDay)}
                          </span>
                          {e.location && <span className="inline-flex items-center gap-1"><MapPin size={14} aria-hidden /> {e.location}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {e.registrationUrl && <Button href={e.registrationUrl} size="sm">Register</Button>}
                        <Link href={`/events/${e.slug}`} aria-label={`Details for ${e.title}`} className="text-muted hover:text-primary">
                          <ArrowRight size={18} aria-hidden />
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
