# Kingdom Builders Christian Fellowship — Website

A fast, accessible, mobile-first site for KBCF (Oakland, CA), built to convert
first-time visitors into Sunday attenders and to let non-technical staff edit
content without touching code.

**Stack:** Next.js (App Router, TypeScript, RSC) · Tailwind CSS v4 · Sanity
(headless CMS, embedded Studio at `/studio`) · deploys to Vercel.

> Status: **staging/preview build.** Do not point DNS or deploy to the live
> domain. Imagery shown is placeholder until real KBCF photos are supplied;
> doctrine/statement-of-faith and bios are explicit placeholders awaiting
> approved copy. No invented testimonials, stats, or quotes.

## Two art directions, one codebase

Both approved directions ship as swappable themes via CSS tokens
(`app/globals.css`):

- **Sanctuary** — warm editorial (Fraunces + Inter; garnet/gold on ivory)
- **Movement** — bold & kinetic (Space Grotesk + Inter; indigo/coral on near-black)

A floating switcher (bottom-right) flips between them live. To lock one in,
delete `components/theme/ThemeSwitcher.tsx` from the layout and set the default
`data-theme` in `app/layout.tsx`. Static mockups live in `/design`.

## Local development

```bash
npm install
cp .env.example .env.local   # optional — site runs on seed data without it
npm run dev                  # http://localhost:3000
```

The site renders from `lib/content/seed.ts` (known KBCF facts + clearly-flagged
samples) until Sanity is connected.

## Content editing (staff)

Once Sanity is connected, all content is editable at `/studio` with no code:
sermons, clips, series, speakers, events, groups, leaders, blog posts,
testimonials, editable pages, and site settings.

## Integrations

| Integration | How it's wired | To go live |
| --- | --- | --- |
| **Sanity CMS** | `lib/content/*`, schemas in `sanity/schemaTypes/*` | Set `NEXT_PUBLIC_SANITY_*` |
| **BoxCast** (live) | `components/watch/BoxcastEmbed.tsx` (channel `wsiikymmlhksnkgmc24r`) | Confirm embed code |
| **Giving** (Clover) | `components/give/CloverGiving.tsx`, URL in site settings | Provider-agnostic; swap URL |
| **Planning Center** | `lib/integrations/planningcenter.ts` (events + groups) | Set `PCO_APP_ID` / `PCO_SECRET` |
| **Connect form** | `app/api/connect` → staff only, never the visitor | Set `STAFF_EMAIL` + `RESEND_API_KEY` |
| **Mailing list** | `app/api/subscribe` (acknowledges only) | Connect Mailchimp/ConvertKit + approve copy |
| **Maps** | `components/map/MapEmbed.tsx` (keyless) | — |

Every integration falls back gracefully to seed/CMS data when its credentials
are absent, so the preview never breaks.

## Accessibility & SEO

WCAG 2.1 AA targeted: keyboard nav, visible focus, required alt text, reduced-
motion support, **zoom never disabled**, skip link. SEO: per-page metadata,
Open Graph, `sitemap.xml`, `robots.txt`, JSON-LD (Church, Event, VideoObject,
BlogPosting), and old-URL redirects in `next.config.ts`.

## Deploy (Vercel preview)

Import the repo into Vercel, add env vars from `.env.example`, deploy. Do **not**
attach the production domain — this is a preview for review.
