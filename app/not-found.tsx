import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { NotFoundBody } from "@/components/blocks/NotFoundBody";
import { getSiteSettings } from "@/lib/content";

export const metadata: Metadata = { title: "Page not found" };

// Root-level 404 (unmatched URLs) lives above the (site) layout, so it mounts the
// site chrome itself — stale WordPress links must not land on a bare page.
export default async function NotFound() {
  const settings = await getSiteSettings();
  return (
    <>
      <Header />
      <main id="main">
        <NotFoundBody />
      </main>
      <Footer settings={settings} />
    </>
  );
}
