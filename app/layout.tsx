import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", style: ["normal", "italic"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kingdombuilders.example";
const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kingdom Builders Christian Fellowship | Oakland, CA",
    template: "%s | Kingdom Builders Christian Fellowship",
  },
  description:
    "Church Like No Other. People are our heart and Jesus is our message. Join us for Sunday Worship at 9:00 AM in Oakland, CA.",
  applicationName: "Kingdom Builders Christian Fellowship",
  openGraph: {
    type: "website",
    siteName: "Kingdom Builders Christian Fellowship",
    title: "Kingdom Builders Christian Fellowship | Oakland, CA",
    description: "Church Like No Other. People are our heart and Jesus is our message.",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  // Search Console: set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION to emit the meta tag.
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
};

// Never disable zoom (accessibility). userScalable defaults to true.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbf6ee",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* Marks JS active so reveal animations engage; no-JS users see content. */}
        <Script id="kbcf-js-init" strategy="beforeInteractive">
          {`document.documentElement.classList.add('js');`}
        </Script>
        {/* Privacy-friendly analytics — loads only when a domain is configured. */}
        {plausibleDomain && (
          <Script defer data-domain={plausibleDomain} src="https://plausible.io/js/script.js" strategy="afterInteractive" />
        )}
        {children}
      </body>
    </html>
  );
}
