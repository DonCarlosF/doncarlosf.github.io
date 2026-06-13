import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { ChurchJsonLd } from "@/components/seo/JsonLd";
import { getSiteSettings } from "@/lib/content";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <>
      <ChurchJsonLd settings={settings} />
      <Header churchName={settings.churchName} />
      <main id="main">{children}</main>
      <Footer settings={settings} />
      <ThemeSwitcher />
    </>
  );
}
