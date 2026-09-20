# KBCF website — agent instructions

This is the **canonical** rulebook for Claude Code, Cursor Cloud Projects, and other coding agents. [`CLAUDE.md`](CLAUDE.md) is the short Claude Code entry (stack, map, do/don’t) and imports this file. Cursor also applies [`.cursor/rules/kbcf.mdc`](.cursor/rules/kbcf.mdc) (non-negotiables only — do not fork policy there).

You are working on the public website for **Kingdom Builders Christian Fellowship (KBCF)** in Oakland, CA. Goal: a fast, accessible, mobile-first site that helps first-time visitors show up on Sunday, and lets non-technical staff edit content in Sanity without touching code.

**Status:** staging/preview. Sanity is usually **not** connected; the site must render from seed data.

---

## 1. Stack (verify in `package.json`, don’t assume)

| Piece | This repo |
| --- | --- |
| Framework | **Next.js 16** App Router (`next@16.2.9`), **React 19**, TypeScript, RSC |
| Styling | **Tailwind CSS v4** via `@tailwindcss/postcss`; tokens in `app/globals.css` `@theme inline` |
| CMS | Sanity (`next-sanity`, `sanity`) — Studio mounted at `/studio` |
| Hosting | Vercel (preview). Production domain is **not** attached. |
| Forms | Route handlers + `zod`; Resend HTTP API when env is set |
| Icons | `lucide-react` |
| Class merge | `cn()` in `lib/utils/cn.ts` (`clsx` + `tailwind-merge`) |

There is **no** Pages Router, **no** `tailwind.config.js`, **no** Planning Center client, **no** theme switcher, **no** test runner / `*.test.*` files.

Next.js 16 APIs differ from older training data. Prefer **existing files in this repo** over invented Next APIs. If `node_modules/next/dist/docs/` exists, read the relevant guide before using an unfamiliar Next API. Heed deprecation notices.

---

## 2. How to run

```bash
npm install
cp .env.example .env.local   # optional
npm run dev                  # http://localhost:3000
npm run lint
npm run build
```

- **Zero env vars is valid.** Seed content in `lib/content/seed.ts` powers the preview.
- `npm run seed:sanity` needs `NEXT_PUBLIC_SANITY_PROJECT_ID` + `SANITY_WRITE_TOKEN` (Editor token — seeding only, never commit it, never put it in Vercel). See `DEPLOY.md`.
- Studio at `/studio` shows a “connect Sanity” message until `NEXT_PUBLIC_SANITY_PROJECT_ID` is set (`sanity/env.ts` → `isSanityConfigured`).

### Env vars (all optional)

From `.env.example` / `LAUNCH.md`:

| Variable | Enables |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical, sitemap, OG, JSON-LD |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` / `DATASET` / `API_VERSION` | Live CMS + `/studio` (API version defaults to `2024-10-01`) |
| `STAFF_EMAIL`, `STAFF_FROM_EMAIL`, `RESEND_API_KEY` | Connect + volunteer notify **staff only** |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Plausible script (omitted when unset) |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Search Console meta |

Do **not** add `PCO_*` or theme-switcher flags — those were removed. Newsletter provider keys in `.env.example` are commented placeholders; `/api/subscribe` must not call a list provider until copy + vendor are approved.

**Never commit secrets.** `.gitignore` ignores `.env*` except `.env.example`.

---

## 3. Directory map

```
app/
  layout.tsx              Root: Fraunces + Inter, metadata, optional Plausible
  globals.css             Sanctuary tokens (locked)
  (site)/                 Public pages + Header/Footer layout
  studio/[[...tool]]/     Embedded Studio (or connect-Sanity placeholder)
  api/{connect,volunteer,subscribe}/
  sitemap.ts, robots.ts, opengraph-image.tsx, not-found.tsx
components/
  ui/                     Button, Card, Container, Section, Media (SmartImage), …
  blocks/                 Home sections (Hero, EventBanner, …)
  layout/                 Header, Footer
  forms/, watch/, give/, events/, groups/, map/, seo/, studio/
lib/
  content/                Unified getters — pages import from here only
    index.ts, client.ts, queries.ts, seed.ts, types.ts, local-images.ts
  integrations/boxcast.ts
  utils/                  cn, format
sanity/                   env.ts, schemaTypes/, structure.ts
scripts/seed-sanity.mjs
public/images/            Optional named photos (see README there)
design/                   Historical HTML mockups — not the live theme system
middleware.ts             WordPress `?page_id=` → 301
next.config.ts            Image hosts + old-URL redirects (308)
```

Import alias: `@/*` → repo root (`tsconfig.json`).

---

## 4. Routes

Header nav: About, New Here, Watch, Give, Events. Footer also: Groups, Dream Center, Blog, Contact.

| Route | Notes |
| --- | --- |
| `/` | Home — hero, banner, service bar, welcome, pathways, pastors, live facade, clips, events, testimonial, Dream Center, giving |
| `/about` | Mission, Five Pillars, Core Values, leadership (`#leadership`). Our Story is an intentional placeholder until pastoral copy exists |
| `/new-here` | Plan a visit + connect form. Some what-to-expect copy is **AI-drafted** and awaits approval (`STATUS.md` §6) |
| `/watch` | BoxCast + sermon archive + published clip rail |
| `/watch/[slug]`, `/watch/series`, `/watch/series/[slug]` | Sermon / series |
| `/give` | Clover **link-out** (not an iframe) |
| `/events`, `/events/[slug]` | CMS-native list/calendar/detail |
| `/groups` | Directory; sample data until Studio is live |
| `/dream-center` | Three H’s, owner-supplied programs, volunteer form |
| `/blog`, `/blog/[slug]` | Portable Text; sample post flagged |
| `/contact` | Map, prayer line, form. Canonical email is an **owner TODO** — do not invent `info@` / `hello@` |
| `/search` | Sermons + blog title/excerpt search |
| `/studio` | CMS; `robots: noindex` |

**Locked removals** (`DECISIONS.md` / `STATUS.md`):

- **Kids & Youth** — owner instruction 2026-06-16. Do not add the route back.
- **Planning Center** — events/groups are CMS-native. Do not restore `lib/integrations/planningcenter.ts`.
- **Theme switcher / multi-theme** — Sanctuary only. Do not restore `[data-theme]`, `ThemeSwitcher`, or extra display fonts.

Old WordPress URLs redirect in `next.config.ts`; `/?page_id=N` is handled in `middleware.ts`. Extend those maps with **real** old URLs only, never guessed slugs.

---

## 5. Content architecture

Every page imports getters from `lib/content/index.ts` and **must not** talk to Sanity directly.

1. If `NEXT_PUBLIC_SANITY_PROJECT_ID` is set, fetch with ISR (`revalidate: 60`).
2. On missing client, empty arrays, or fetch errors → seed (`lib/content/seed.ts`).
3. Singletons (`getHomePage`, `getAboutPage`) **merge** CMS fields over seed so a half-filled Studio doc cannot blank a page.
4. Photos: CMS image `src` wins; else `public/images/<name>.{jpg,jpeg,png,webp,avif}` via `localOr()`; else a labeled placeholder (`SmartImage` in `components/ui/Media.tsx`). Never show a stock/fake photograph.

### CMS schema (`sanity/schemaTypes/`)

Objects: `accessibleImage`, `serviceTime`, `socialLink`.  
Singletons: `siteSettings`, `homePage`, `aboutPage`.  
Documents: `sermon`, `clip`, `series`, `speaker`, `event`, `group`, `leader`, `outreachProgram`, `blogPost`, `testimonial`.

The generic `page` schema was **deleted** — don’t add it back.

Staff workflow: `STAFF-GUIDE.md`. Seed command: `DEPLOY.md`. Desk structure: `sanity/structure.ts`.

### Clip bridge (`CLIP_CONTRACT.md`)

This repo **reads** `clip` documents. `church-clip-manager` **writes** them with its own token (not in this repo).

- `_id`: `clip-{YYYY-MM-DD}-{slot}` (`slot` 1–4), `createOrReplace`
- Site GROQ: `status == "published"` only (Studio default is `scheduled`)
- Inline play: YouTube → tap-to-load `youtube-nocookie` iframe; else first of Instagram/TikTok as a link
- Changing the contract without the other repo **breaks the clip pipeline**

---

## 6. Content integrity (non-negotiable)

From `lib/content/seed.ts` source-of-truth rules:

1. **Only verified KBCF facts** may be stated as fact (address, pastors’ names/roles, owner-supplied programs/stats, the Brenda H. testimonial, BoxCast channel id, Clover URL, Facebook URL, copy already supplied by the church).
2. Unknown facts are omitted, `undefined`, or marked `sample` / `placeholder` / `TODO(owner)` / “coming soon”.
3. **Never invent** doctrine, statement-of-faith text, bios, testimonials, quotes, attendance/impact stats, sermon titles, photos, phone numbers, emails, or social accounts.
4. Placeholders must stay **clearly labeled** in the UI (`SmartImage` labels, “Sample — Edit in Studio”, `[Placeholder…]`). Do not “polish” them into looking real.
5. Do not silently “fix” owner TODOs (canonical email, service-time confirmation, Dr. Karen extended bio, Our Story / statement of faith). Those need church approval (`STATUS.md` §6, `LAUNCH.md` §4).
6. Dream Center stats render **only** where the owner supplied them. Don’t extrapolate.
7. Sample clip-1’s YouTube URL is YouTube’s public first video, labeled as a sample to exercise inline play — replace in Studio; don’t treat it as a KBCF sermon.

Copy already in seed (welcome, Five Pillars, Core Values, program names/stats, Brenda H.) was supplied or implemented from church docs. **Do not expand or paraphrase it into new claims.** AI-drafted New Here / meta / giving blurbs still need pastoral sign-off — don’t double down on unverified details (e.g. “about 90 minutes”, parking).

---

## 7. Design system (Sanctuary — locked)

Live look is **Direction A “Sanctuary”** only (`app/globals.css`):

- Display **Fraunces**, body **Inter** (loaded in `app/layout.tsx`)
- Ivory background `#fbf6ee`, garnet primary `#7a1e2b`, gold accent `#e0a53a`
- Semantic Tailwind colors: `bg`, `surface`, `surface-2`, `border`, `fg`, `muted`, `primary`, `primary-fg`, `accent`, `accent-fg`, `cta`, `cta-fg`, `ring`
- Radii: `rounded-card` (18px), `rounded-btn` (pill)
- Motion: slow cinematic (`--dur: 0.5s`); `.reveal` + `components/ui/Reveal.tsx`; honor `prefers-reduced-motion`

`design/DESIGN-NOTES.md` and `design/*.html` describe **historical** multi-theme proposals (Sanctuary / Grove / Sterling / Ember / Movement). They are **not** how the running app works. README still mentions a live theme switcher — **ignore that**; `DECISIONS.md` “Theme lock” is the decision of record.

Class hooks `kbcf-eyebrow` / `kbcf-section-title` / `kbcf-card` / `kbcf-more` may still appear in JSX as inert markers — don’t build a second theme around them unless the owner asks.

Reuse `components/ui/Button`, `Section`, `Container`, `Card`, `SmartImage`. Don’t introduce a new component library.

---

## 8. Integrations (optional, must degrade)

| Integration | Where | Behavior without credentials |
| --- | --- | --- |
| Sanity | `lib/content/*`, `sanity/` | Seed data; `/studio` shows connect instructions |
| BoxCast | `components/watch/BoxcastEmbed.tsx`, `BoxcastFacade.tsx`, channel id in `siteSettings.boxcastId` (`wsiikymmlhksnkgmc24r`) | Themed empty/facade; Home must **not** load an iframe until tap (`BoxcastFacade`) |
| Clover giving | `components/give/CloverGiving.tsx`, URL in site settings | Link-out. **Do not iframe** — Clover sends `frame-ancestors *.clover.com` |
| Connect + volunteer | `app/api/connect`, `app/api/volunteer` | Honeypot `company` + zod; Resend to `STAFF_EMAIL` if configured; else **server log**. **Never email the visitor** |
| Newsletter | `app/api/subscribe` | Acknowledge + log only |
| Maps | `components/map/MapEmbed.tsx` | Keyless query embed |
| Plausible / GSC | `app/layout.tsx` metadata | Scripts/tags omitted when env unset |

Giving stays on Clover; BoxCast donations stay **off** (`showDonations=0` in `boxcastEmbedUrl`).

---

## 9. Accessibility, SEO, performance

Targets (measured Home mobile prod build — `STATUS.md`): Lighthouse Perf ~94, A11y 100, SEO 100. Don’t regress on purpose.

- WCAG 2.1 AA: keyboard nav, `:focus-visible`, required image `alt`, skip link to `#main`, **zoom never disabled** (`userScalable` stays default true)
- Per-page `metadata`, OG image, `sitemap.xml`, `robots.txt`
- JSON-LD: Church / Event / VideoObject / BlogPosting (`components/seo/JsonLd.tsx`)
- Home: zero BoxCast/YouTube iframes at first paint (facades)
- Event banner expires 24h after a **parseable** date; unparseable dates **fail open** (stay visible). Empty banner → soonest upcoming event (`DECISIONS.md`)

---

## 10. Deploy constraints

- Preview/staging **only**. Do not attach `kingdombuilderscf.org` or `www`, do not change DNS, do not “go to production” as an agent task.
- `LAUNCH.md` is a **human** cutover runbook (CHURCH / EDITOR). Do not execute those steps.
- `DEPLOY.md` is how to hang a `*.vercel.app` preview and optionally connect Sanity.
- Default site URL fallback in code is a placeholder (`kingdombuilders.example`) until `NEXT_PUBLIC_SITE_URL` is set.

---

## 11. Coding conventions

- **Server Components by default.** `"use client"` only for interactivity (header menu, forms, clip rail, events explorer, Studio).
- Pages get data via `lib/content` getters, not ad-hoc fetches.
- Match existing naming, file placement, and Tailwind token usage.
- Forms: zod + honeypot; keep staff-only notification semantics.
- Images: `SmartImage` / `next/image`; always `alt`.
- Don’t add dependencies unless the task requires them.
- Don’t revive deleted modules (PCO, theme switcher, `page` schema, `heroVideoUrl`, ticker CSS).
- `npm run lint` (`eslint-config-next`) and `npm run build` should stay clean for code changes.

---

## 12. Document authority (README is partly stale)

When docs disagree, use this order:

1. **Running code**
2. **`DECISIONS.md`** — locked calls (theme, clips, PCO removal, redirects, analytics)
3. **`STATUS.md`** — what’s built vs placeholder vs owner TODO
4. **`CLIP_CONTRACT.md`** — clip document shape
5. **`DEPLOY.md` / `LAUNCH.md` / `STAFF-GUIDE.md`** — human ops (don’t run cutover)
6. **`README.md`** — overview; **out of date** on live theme switching and Planning Center
7. **`design/DESIGN-NOTES.md`** — historical art-direction proposals only

If you change architecture or a locked decision, update `DECISIONS.md` / `STATUS.md` in the same PR. Don’t “fix” README’s theme/PCO sections unless the task is explicitly docs cleanup.

---

## 13. Known church facts (safe to use; don’t invent beyond this)

- Name: Kingdom Builders Christian Fellowship · Oakland, CA
- Address: 1431 17th Avenue, Oakland, CA 94606
- Phone: (510) 326-2446 · Prayer line in seed (with passcode)
- Tagline: “Church Like No Other” · Mission: “People are our heart and Jesus is our message.”
- Pastors: Dr. LJ Jennings (Founder & Senior Pastor), Dr. Karen Jennings (Co-Pastor); church established 2009
- Facebook: `https://www.facebook.com/kingdombuilderscf`
- BoxCast channel id: `wsiikymmlhksnkgmc24r`
- Giving: Clover hosted pay widget (URL in `siteSettings`)
- Dream Center: Housing, Health, Hunger; ~40-unit Eastmont/MacArthur housing story; program stats as seeded
- Service times exist in seed **with `TODO(owner): confirm`** — display them, don’t treat confirmation as done
- Canonical public email: **not decided**

---

## 14. Suggested workflow for agents

1. Read this file + `STATUS.md` + `DECISIONS.md` for the area you touch.
2. Change the smallest set of files; match neighbors.
3. Keep seed/CMS fallbacks and labeled placeholders intact.
4. `npm run lint` and `npm run build` for code changes.
5. For UI, exercise the route (and other routes that share the state you touched).
6. Do not push/merge to `main` unless the human asked. Don’t attach production domains.
