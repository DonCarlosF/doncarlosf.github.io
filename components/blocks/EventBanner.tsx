import { CalendarDays, MapPin, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import type { EventBanner as EventBannerType } from "@/lib/content/types";

/** Dismissible-style announcement banner for a one-off gathering. Editable via
 *  the homePage singleton (title / date / location / CTA). */
export function EventBanner({ banner }: { banner?: EventBannerType }) {
  if (!banner || banner.enabled === false || !banner.title) return null;
  const external = banner.ctaHref ? /^https?:\/\//.test(banner.ctaHref) : false;

  return (
    <div className="bg-accent text-accent-fg">
      <Container className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 py-3 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold">
          <CalendarDays size={16} aria-hidden /> {banner.title}
        </span>
        {banner.date && <span className="font-medium">· {banner.date}</span>}
        {banner.location && (
          <span className="inline-flex items-center gap-1.5 opacity-90">
            <MapPin size={15} aria-hidden /> {banner.location}
          </span>
        )}
        {banner.ctaLabel && banner.ctaHref && (
          <a
            href={banner.ctaHref}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:no-underline"
          >
            {banner.ctaLabel} <ArrowRight size={14} aria-hidden />
          </a>
        )}
      </Container>
    </div>
  );
}
