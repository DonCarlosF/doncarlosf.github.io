# Kingdom Builders Christian Fellowship — Website

A fast, accessible, mobile-first site for KBCF (Oakland, CA), built to convert
first-time visitors into Sunday attenders and to let non-technical staff edit
content without touching code.

**Stack:** Next.js 16 (App Router, React Server Components, React Compiler) ·
React 19 · Tailwind CSS v4 · Sanity v6 (headless CMS, embedded Studio at
`/studio`) · TypeScript · deploys to Vercel. Requires **Node 22.12+** (`.nvmrc`).

> Status: **staging/preview build.** Do not point DNS or deploy to the live
> domain until the steps in `LAUNCH.md` are done. Imagery is placeholder until
> real KBCF photos are supplied; a few copy blocks are explicit placeholders
> awaiting approval (see `STATUS.md`). No invented testimonials, stats, or quotes.

## Design

One art direction ships — **Sanctuary** (warm editorial: Fraunces + Inter,
garnet/gold on ivory). The tokens live in `app/globals.css`; every component
references semantic tokens only. The original direction mockups are kept in
`/design` for reference (`design/DESIGN-NOTES.md`).

## Local development

```bash
nvm use                      # Node 22 (see .nvmrc)
npm ci
cp .env.example .env.local   # optional — the site runs on seed data without it
npm run dev                  # http://localhost:3000
```

Quality gates (the same ones CI runs on every push and pull request):

```bash
npm run check      # lint + typecheck + production build
npm run test:e2e   # Playwright smoke + axe (WCAG 2.1 AA) over every route — run after `npm run build`
```

Until Sanity is connected the site renders from `lib/content/seed.ts` (known
KBCF facts + clearly-flagged samples). Seeded samples are excluded from the
sitemap and marked `noindex`, so nothing placeholder can be indexed by accident.

## Content editing (staff)

Once Sanity is connected, all content is editable at `/studio` with no code:
sermons, clips, series, speakers, events, groups, leaders, blog posts,
testimonials, the Home/About pages, and site settings. See `STAFF-GUIDE.md`.
Sanity is the single source of truth: once connected, an empty collection
renders empty rather than falling back to seed samples.

Publishing is live within seconds when the Sanity webhook is configured
(`POST /api/revalidate`, see `DEPLOY.md`); otherwise pages refresh within five
minutes.

## Integrations

| Integration | How it's wired | To go live |
| --- | --- | --- |
| **Sanity CMS** | `lib/content/*`, schemas in `sanity/schemaTypes/*` | Set `NEXT_PUBLIC_SANITY_*` |
| **Publish webhook** | `app/api/revalidate` expires the `sanity` cache tag | Set `SANITY_REVALIDATE_SECRET` + a Sanity webhook |
| **BoxCast** (live + archive) | `components/watch/BoxcastEmbed.tsx`, click-to-load facade on Home | Confirm channel id in Site Settings |
| **YouTube** (sermon video) | `components/watch/YouTubeFacade.tsx` — poster + tap-to-play, no player JS at load | Paste a video URL on a sermon |
| **Giving** (Clover) | `components/give/CloverGiving.tsx`, link-out by locked decision | URL in Site Settings |
| **Connect / Volunteer forms** | `app/api/connect`, `app/api/volunteer` → staff only, never the visitor | Set `STAFF_EMAIL` + `RESEND_API_KEY` |
| **Mailing list** | `app/api/subscribe` (acknowledges only) | Connect Mailchimp/ConvertKit + approve copy |
| **Analytics** | Plausible, loads only when `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set | Add the site in Plausible |
| **Maps** | `components/map/MapEmbed.tsx` (keyless) | — |

Every integration falls back gracefully when its credentials are absent, so
the preview never breaks. Form notifications that Resend rejects are logged as
`UNDELIVERED` so a misconfigured key can never hide submissions.

## Accessibility, SEO, security

- WCAG 2.1 AA targeted and **tested**: axe runs over every route in CI; keyboard
  nav, visible focus, required alt text, reduced-motion support, a pausable hero
  slideshow, announced form results, **zoom never disabled**, skip link.
- SEO: per-page metadata and Open Graph, canonical URLs, `sitemap.xml`,
  `robots.txt`, JSON-LD (Church, Event, VideoObject, BlogPosting), and the old
  WordPress URL map (paths and `?page_id=N`) as declarative redirects.
- Security headers on every response (HSTS, nosniff, frame denial, referrer and
  permissions policies) plus a Content-Security-Policy in report-only mode —
  enforce it after checking the console per `LAUNCH.md`.
- All dates render in `America/Los_Angeles` so the server and every browser agree.

## Deploy

Import the repo into Vercel from `main` and add env vars from `.env.example`
(the site builds with none). Full steps: `DEPLOY.md`; cutover runbook:
`LAUNCH.md`. Do **not** attach the production domain until the runbook is done.

## Repository guide

| File | What it's for |
| --- | --- |
| `DEPLOY.md` | Vercel + Sanity setup for the preview |
| `LAUNCH.md` | Ordered cutover runbook to the live domain |
| `STAFF-GUIDE.md` | Non-technical editing guide for `/studio` |
| `STATUS.md` | What's built, partial, or awaiting content |
| `DECISIONS.md` | Locked decisions and judgment calls (including the platform upgrade) |
| `CLIP_CONTRACT.md` | Interface with the `church-clip-manager` repo |
| `e2e/`, `.github/workflows/ci.yml` | Playwright/axe suite and CI |
