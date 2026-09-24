import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { NotFoundMessage } from "@/components/layout/NotFoundMessage";
import { getSiteSettings } from "@/lib/content";

/** Unmatched URLs skip the site layout, so this page brings its own chrome. */
export default async function NotFound() {
  const settings = await getSiteSettings();
  return (
    <>
      <Header />
      <main id="main">
        <NotFoundMessage />
      </main>
      <Footer settings={settings} />
    </>
  );
}
