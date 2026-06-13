import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider, themeInitScript } from "@/components/theme/ThemeProvider";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", style: ["normal", "italic"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://kingdombuilders.example";

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
};

// Never disable zoom (accessibility). userScalable defaults to true.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf6ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0f" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="sanctuary"
      suppressHydrationWarning
      className={`${fraunces.variable} ${inter.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Script id="kbcf-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
