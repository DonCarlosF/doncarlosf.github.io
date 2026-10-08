import type { SiteSettings } from "@/lib/content/types";
import { siteUrl } from "@/lib/site-url";

/** Generic JSON-LD emitter. `<` is escaped so CMS-authored text can never close the script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

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
    // Service times are free text ("9:00–10:45 AM"), which schema.org's Schedule
    // can't express; the Events pages carry the validated Event markup instead.
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: settings.churchName,
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <JsonLd data={church} />
      <JsonLd data={website} />
    </>
  );
}
