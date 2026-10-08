import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";

// The italic face is only used by the Home hero, so it is loaded (and preloaded)
// there — see app/(site)/page.tsx — instead of on every route.
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  // Relative canonical resolves per route, so query-string variants collapse to the clean path.
  alternates: { canonical: "./" },
  title: {
    default: "Kingdom Builders Christian Fellowship | Oakland, CA",
    template: "%s | Kingdom Builders Christian Fellowship",
  },
  description:
    "Church Like No Other. People are our heart and Jesus is our message. Join us for Sunday Worship at 9:00 AM in Oakland, CA.",
  applicationName: "Kingdom Builders Christian Fellowship",
  // No title/description here: each page's own title/description then flows
  // into its og:/twitter: tags instead of every page sharing the site-wide ones.
  openGraph: {
    type: "website",
    siteName: "Kingdom Builders Christian Fellowship",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
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
    <html lang="en" data-scroll-behavior="smooth" className={`${fraunces.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* Privacy-friendly analytics — loads only when a domain is configured. */}
        {plausibleDomain && (
          <Script defer data-domain={plausibleDomain} src="https://plausible.io/js/script.js" strategy="afterInteractive" />
        )}
        {children}
      </body>
    </html>
  );
}
