import Link from "next/link";
import { MapPin } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import type { SiteSettings } from "@/lib/content/types";

export function Footer({ settings }: { settings: SiteSettings }) {
  const { address } = settings;
  const mapsHref = `https://maps.google.com/?q=${encodeURIComponent(settings.mapEmbedQuery)}`;

  return (
    <footer className="border-t border-border bg-surface-2 text-fg">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.4fr]">
          <div>
            <p className="font-display text-2xl font-semibold">Kingdom Builders</p>
            <p className="mt-3 max-w-xs text-sm text-muted">{settings.tagline}. {settings.mission}</p>
            <p className="mt-4 flex items-start gap-2 text-sm text-muted">
              <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden />
              <a href={mapsHref} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                {address.street}, {address.city}, {address.state} {address.zip}
              </a>
            </p>
          </div>

          <nav aria-label="Visit">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Visit</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li><Link href="/new-here" className="hover:text-fg">Plan Your Visit</Link></li>
              <li><Link href="/watch" className="hover:text-fg">Watch Live</Link></li>
              <li><Link href="/events" className="hover:text-fg">Events</Link></li>
              <li><Link href="/give" className="hover:text-fg">Give</Link></li>
            </ul>
          </nav>

          <nav aria-label="Connect">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Connect</h2>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li><Link href="/groups" className="hover:text-fg">Groups</Link></li>
              <li><Link href="/dream-center" className="hover:text-fg">Dream Center</Link></li>
              <li><Link href="/blog" className="hover:text-fg">Blog</Link></li>
              <li><Link href="/contact" className="hover:text-fg">Contact</Link></li>
            </ul>
          </nav>

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Stay in the loop</h2>
            <p className="mt-4 text-sm text-muted">Service times: {settings.serviceTimes.map((s) => `${s.day} ${s.time || s.label}`).join(" · ")}</p>
            <div className="mt-4">
              <NewsletterForm />
            </div>
            {settings.social.length > 0 ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {settings.social.map((s) => (
                  <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer"
                     className="rounded-full border border-border px-3 py-1.5 text-xs font-medium capitalize hover:border-primary hover:text-primary">
                    {s.platform}
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-muted/70">Social links can be added in the CMS.</p>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {settings.churchName}</p>
          <p>Church Like No Other · Oakland, CA</p>
        </div>
      </Container>
    </footer>
  );
}
