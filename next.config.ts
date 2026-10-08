import type { NextConfig } from "next";

/** Old WordPress `?page_id=N` links (ids fetched from the live site's wp-json API)
 *  → new routes, matched declaratively so the homepage stays a static asset with
 *  no function in front of it. Unknown ids simply render the homepage (the query
 *  string is ignored), and id 365 (old home) is omitted because `/` → `/` would loop. */
const WP_PAGE_IDS: Record<string, string> = {
  "1657": "/watch",        // livestream
  "1352": "/dream-center",
  "1284": "/groups",
  "1290": "/new-here",
  "1030": "/about",
  "255": "/give",          // giving
  "99": "/blog",
  "25": "/contact",
  "23": "/new-here",       // get-connected
  "19": "/events",
};

// Baseline hardening. Feature permissions the site never uses are denied; media
// permissions (autoplay, fullscreen, picture-in-picture) are left alone for the
// BoxCast/YouTube players. Nothing legitimately frames the site.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
];

// Content-Security-Policy, shipped REPORT-ONLY first: every page is prerendered
// (nonces would force dynamic rendering) so 'unsafe-inline' stays for Next's
// hydration payload and inline styles. Watch the browser console on /, /watch,
// /contact, /events and /studio, then rename the key to Content-Security-Policy.
const isDev = process.env.NODE_ENV === "development";
const csp = (directives: Record<string, string>) =>
  Object.entries(directives).map(([k, v]) => (v ? `${k} ${v}` : k)).join("; ");

const siteCsp = csp({
  "default-src": "'self'",
  "script-src": `'self' 'unsafe-inline' https://plausible.io${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src": "'self' 'unsafe-inline'",
  "img-src": "'self' data: blob: https://cdn.sanity.io https://i.ytimg.com",
  "font-src": "'self'",
  "media-src": "'self' https://cdn.sanity.io",
  "connect-src": "'self' https://plausible.io",
  "frame-src": "https://boxcast.tv https://www.youtube-nocookie.com https://www.google.com",
  "object-src": "'none'",
  "base-uri": "'self'",
  "form-action": "'self'",
  "frame-ancestors": "'none'",
  // Add "upgrade-insecure-requests" when switching to the enforcing header; Chrome
  // ignores it under Report-Only and logs a console error for it.
});

// The embedded Studio talks to Sanity's API/websocket and uses blob workers.
const studioCsp = csp({
  "default-src": "'self'",
  "script-src": `'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src": "'self' 'unsafe-inline'",
  "img-src": "'self' data: blob: https://cdn.sanity.io https://*.sanity.io",
  "font-src": "'self' data:",
  "connect-src": "'self' https://*.api.sanity.io wss://*.api.sanity.io https://api.sanity.io https://*.sanity.io",
  "frame-src": "'self' https://*.sanity.io",
  "worker-src": "'self' blob:",
  "child-src": "blob:",
  "object-src": "'none'",
  "base-uri": "'self'",
  "form-action": "'self'",
  "frame-ancestors": "'none'",
});

const nextConfig: NextConfig = {
  reactCompiler: true,

  images: {
    // Only the hosts the site actually loads from, each scoped to its image path.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.sanity.io", pathname: "/images/**" },
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" }, // YouTube poster fallback
    ],
  },

  async headers() {
    return [
      { source: "/((?!studio).*)", headers: [...securityHeaders, { key: "Content-Security-Policy-Report-Only", value: siteCsp }] },
      { source: "/studio/:path*", headers: [...securityHeaders, { key: "Content-Security-Policy-Report-Only", value: studioCsp }] },
    ];
  },

  // Redirects from old WordPress URLs so existing links/SEO don't 404.
  async redirects() {
    return [
      ...Object.entries(WP_PAGE_IDS).map(([id, destination]) => ({
        source: "/",
        has: [{ type: "query" as const, key: "page_id", value: id }],
        destination,
        permanent: true,
      })),
      { source: "/home", destination: "/", permanent: true },
      { source: "/giving", destination: "/give", permanent: true },
      { source: "/give-online", destination: "/give", permanent: true },
      { source: "/live", destination: "/watch", permanent: true },
      { source: "/livestream", destination: "/watch", permanent: true },
      { source: "/watch-live", destination: "/watch", permanent: true },
      { source: "/sermons", destination: "/watch", permanent: true },
      { source: "/messages", destination: "/watch", permanent: true },
      { source: "/about-us", destination: "/about", permanent: true },
      { source: "/im-new", destination: "/new-here", permanent: true },
      { source: "/imnew", destination: "/new-here", permanent: true },
      { source: "/plan-your-visit", destination: "/new-here", permanent: true },
      { source: "/connect", destination: "/new-here", permanent: true },
      { source: "/dreamcenter", destination: "/dream-center", permanent: true },
      { source: "/the-dream-center", destination: "/dream-center", permanent: true },
      { source: "/about/new-here", destination: "/new-here", permanent: true },
      { source: "/about/groups", destination: "/groups", permanent: true },
      { source: "/get-connected", destination: "/new-here", permanent: true },
      // Real old WordPress post slugs (fetched from the live wp-json API) — root-level permalinks.
      { source: "/the-ultimate-mother-in-law", destination: "/blog", permanent: true },
      { source: "/jochebed-mother-of-courage", destination: "/blog", permanent: true },
      { source: "/leah-mother-of-many-sons", destination: "/blog", permanent: true },
      { source: "/mother-protector-of-her-dead", destination: "/blog", permanent: true },
      { source: "/mother-of-two-nations", destination: "/blog", permanent: true },
      { source: "/mother-of-many-nations", destination: "/blog", permanent: true },
      { source: "/the-original-mother", destination: "/blog", permanent: true },
      { source: "/signed-sealed-delivered-im-yours", destination: "/blog", permanent: true },
      { source: "/the-power-of-the-tongue", destination: "/blog", permanent: true },
      { source: "/changing-lanes-to-stake-claim-to-your-territory", destination: "/blog", permanent: true },
      { source: "/2-ways-to-stake-claim-to-your-territory", destination: "/blog", permanent: true },
      { source: "/7-tenants-of-the-financial-covenant", destination: "/blog", permanent: true },
      { source: "/this-weeks-visual-word", destination: "/blog", permanent: true },
      { source: "/10-questions-answers-about-tithing", destination: "/blog", permanent: true },
    ];
  },
};

export default nextConfig;
