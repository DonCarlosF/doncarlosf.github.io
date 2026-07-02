import type { SiteSettings } from "@/lib/content/types";

/** Generic JSON-LD emitter. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kingdombuilders.example";

/** Church + WebSite structured data (SEO: rich results, knowledge panel). */
export function ChurchJsonLd({ settings }: { settings: SiteSettings }) {
  const church = {
    "@context": "https://schema.org",
    "@type": "Church",
    name: settings.churchName,
    alternateName: "KBCF",
    slogan: settings.tagline,
    url: siteUrl,
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address.street,
      addressLocality: settings.address.city,
      addressRegion: settings.address.state,
      postalCode: settings.address.zip,
      addressCountry: "US",
    },
    ...(settings.phone ? { telephone: settings.phone } : {}),
    ...(settings.email ? { email: settings.email } : {}),
    ...(settings.social.length ? { sameAs: settings.social.map((s) => s.url) } : {}),
    // Call-in gatherings (s.phone set) are excluded: they don't happen at the
    // building, and a physical-location Event for them would be wrong.
    event: settings.serviceTimes.filter((s) => !s.phone).map((s) => ({
      "@type": "Event",
      name: `${s.day} ${s.label}`,
      eventSchedule: { "@type": "Schedule", byDay: s.day, startTime: s.time },
      location: {
        "@type": "Place",
        name: settings.churchName,
        address: `${settings.address.street}, ${settings.address.city}, ${settings.address.state} ${settings.address.zip}`,
      },
    })),
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.churchName,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/search?q={query}`,
      "query-input": "required name=query",
    },
  };

  return (
    <>
      <JsonLd data={church} />
      <JsonLd data={website} />
    </>
  );
}
