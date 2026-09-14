/**
 * Canonical site origin, resolved once for metadata, sitemap, robots and JSON-LD.
 *
 * Set NEXT_PUBLIC_SITE_URL in production. On Vercel the system variables fill in
 * otherwise, so preview deploys never advertise a placeholder domain in
 * social-share cards or the sitemap.
 */
const fromEnv =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  "http://localhost:3000";

export const siteUrl = fromEnv.replace(/\/+$/, "");
