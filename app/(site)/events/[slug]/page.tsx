import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin, Repeat } from "lucide-react";
import { Section, Eyebrow } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { SmartImage } from "@/components/ui/Media";
import { JsonLd } from "@/components/seo/JsonLd";
import { getEvent, getEvents, getSiteSettings } from "@/lib/content";
import { formatEventDate } from "@/lib/utils/format";

export async function generateStaticParams() {
  const events = await getEvents();
  return events.map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return { title: "Event not found" };
  return {
    title: event.title,
    description: event.description || `Join us for ${event.title}.`,
    // Seeded placeholders must never be indexed if DNS moves before the CMS is live.
    ...(event.sample ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [event, settings] = await Promise.all([getEvent(slug), getSiteSettings()]);
  if (!event) notFound();
  const { address } = settings;

  return (
    <Section>
      <Link href="/events" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2">
        <ArrowLeft size={16} aria-hidden /> All events
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <SmartImage image={event.image || { alt: event.title, placeholder: true }} preload />
          {event.description && <p className="mt-6 text-lg text-muted">{event.description}</p>}
        </div>
        <aside>
          <Eyebrow>Event</Eyebrow>
          <h1 className="mt-2 font-display text-3xl font-semibold">{event.title}</h1>
          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex items-center gap-3">
              {event.recurrence ? <Repeat size={18} className="text-primary" aria-hidden /> : <CalendarDays size={18} className="text-primary" aria-hidden />}
              <span>{event.recurrence || formatEventDate(event.start, event.allDay)}</span>
            </li>
            {event.location && (
              <li className="flex items-center gap-3">
                <MapPin size={18} className="text-primary" aria-hidden /> <span>{event.location}</span>
              </li>
            )}
          </ul>
          {event.registrationUrl && (
            <div className="mt-6">
              <Button href={event.registrationUrl} size="lg">Register</Button>
            </div>
          )}
        </aside>
      </div>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Event",
          name: event.title,
          startDate: event.start,
          ...(event.end ? { endDate: event.end } : {}),
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          ...(event.description ? { description: event.description } : {}),
          // Google requires a postal address on offline events; default to the church.
          location: {
            "@type": "Place",
            name: event.location || settings.churchName,
            address: {
              "@type": "PostalAddress",
              streetAddress: address.street,
              addressLocality: address.city,
              addressRegion: address.state,
              postalCode: address.zip,
              addressCountry: "US",
            },
          },
          organizer: { "@type": "Organization", name: settings.churchName },
          ...(event.registrationUrl ? { offers: { "@type": "Offer", url: event.registrationUrl } } : {}),
        }}
      />
    </Section>
  );
}
