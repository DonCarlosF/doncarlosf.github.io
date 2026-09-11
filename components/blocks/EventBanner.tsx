import Link from "next/link";
import { CalendarDays, MapPin, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { formatEventDate } from "@/lib/utils/format";
import type { EventBanner as EventBannerType, ChurchEvent } from "@/lib/content/types";

/** True when the banner's human-readable date is parseable and already past
 *  (with a one-day grace window). Unparseable dates never expire the banner. */
function isExpired(date?: string): boolean {
  if (!date) return false;
  const t = Date.parse(date);
  return !Number.isNaN(t) && t < Date.now() - 24 * 60 * 60 * 1000;
}

/**
 * Announcement banner. Editable via the homePage singleton; auto-hides once its
 * date has passed. When no (current) banner is set, falls back to the soonest
 * upcoming event so the strip never advertises stale news.
 */
export function EventBanner({ banner, fallbackEvent }: { banner?: EventBannerType; fallbackEvent?: ChurchEvent }) {
  const bannerLive = banner && banner.enabled !== false && banner.title && !isExpired(banner.date);

  if (!bannerLive && fallbackEvent) {
    const e = fallbackEvent;
    return (
      <div className="bg-accent text-accent-fg">
        <Container className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 py-3 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold">
            <CalendarDays size={16} aria-hidden /> {e.title}
          </span>
          <span className="font-medium">· {e.recurrence || formatEventDate(e.start, e.allDay)}</span>
          {e.location && (
            <span className="inline-flex items-center gap-1.5 opacity-90">
              <MapPin size={15} aria-hidden /> {e.location}
            </span>
          )}
          <Link href={`/events/${e.slug}`} className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:no-underline">
            Event details <ArrowRight size={14} aria-hidden />
          </Link>
        </Container>
      </div>
    );
  }

  if (!bannerLive) return null;
  const b = banner!;
  const external = b.ctaHref ? /^https?:\/\//.test(b.ctaHref) : false;

  return (
    <div className="bg-accent text-accent-fg">
      <Container className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 py-3 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold">
          <CalendarDays size={16} aria-hidden /> {b.title}
        </span>
        {b.date && <span className="font-medium">· {b.date}</span>}
        {b.location && (
          <span className="inline-flex items-center gap-1.5 opacity-90">
            <MapPin size={15} aria-hidden /> {b.location}
          </span>
        )}
        {b.ctaLabel && b.ctaHref && (
          <a
            href={b.ctaHref}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:no-underline"
          >
            {b.ctaLabel} <ArrowRight size={14} aria-hidden />
          </a>
        )}
      </Container>
    </div>
  );
}
