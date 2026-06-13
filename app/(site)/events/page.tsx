import type { Metadata } from "next";
import { PageHeader } from "@/components/blocks/PageHeader";
import { Section } from "@/components/ui/Section";
import { EmptyState } from "@/components/ui/EmptyState";
import { EventsView } from "@/components/events/EventsView";
import { getUpcomingEventsAll } from "@/lib/content";

export const metadata: Metadata = {
  title: "Events",
  description: "Upcoming gatherings, services, and events at Kingdom Builders Christian Fellowship.",
};

export default async function EventsPage() {
  const upcoming = await getUpcomingEventsAll();

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
          <EventsView events={upcoming} />
        )}
      </Section>
    </>
  );
}
