import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ChurchJsonLd } from "@/components/seo/JsonLd";
import { getSiteSettings } from "@/lib/content";

// Time-dependent content (upcoming events, banner expiry, © year) is computed at
// render. Without Sanity nothing fetches, so pages would otherwise be frozen at
// build time; this re-renders them hourly. With Sanity connected the 5-minute
// fetch revalidate (the lowest value on the route) wins.
export const revalidate = 3600;

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <>
      <ChurchJsonLd settings={settings} />
      <Header />
      <main id="main">{children}</main>
      <Footer settings={settings} />
    </>
  );
}
