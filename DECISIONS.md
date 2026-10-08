# DECISIONS.md — judgment calls made without pausing

## Clip bridge (Task 1)
- **Sanity over `clips.json`.** The read side targets Sanity clip docs only; a JSON
  manifest reader was skipped — one source of truth, and the clip repo already
  plans HTTP upserts. Shape + `_id` convention documented in `CLIP_CONTRACT.md`.
- **Strict `status === "published"` filter** (no grandfathering of docs missing
  `status`). Studio default is `scheduled`, so a forgotten flip means "not live" —
  the intended editorial workflow.
- **Seed sample clip-1 carries a public YouTube URL** (`jNQXAC9IVRw`, YouTube's
  first-ever 19s video) purely to exercise the inline-play facade in preview. It is
  clearly labeled "Sample clip — replace in Studio". clip-3 is `scheduled` to prove
  the filter hides it.
- **Empty state** ships on the Watch rail; the Home latest-message mini-rail stays
  conditional (a "coming soon" box on the homepage adds noise where space is tight).
- Inline play uses `youtube-nocookie.com` embeds, loaded only on tap (no iframe cost
  at page load).

## Dream Center (Task 2)
- Program descriptions are minimal, fact-derived one-liners (no invented impact
  claims); stats render only where the owner supplied them. The three-H's card
  blurbs summarize which supplied programs sit under each H — review welcome.
- Headline stat on Home = "500+ households fed every week" (the strongest supplied
  weekly number).

## Theme lock (locked decision)
- Sanctuary tokens moved to `:root`; grove/sterling/ember/movement token sets, all
  `[data-theme]` rules, `ThemeSwitcher`, `useTheme`, and 4 font families deleted.
- `kbcf-eyebrow / kbcf-section-title / kbcf-card / kbcf-more` class hooks remain in
  JSX as inert markers (their CSS was dark-theme-only) — harmless, and useful if a
  second theme ever returns.
- Unused Direction-B ticker CSS (`.ticker-track`, marquee keyframes) removed — the
  ticker component was never built; revisit only if the owner asks for it.

## Performance (Task 3) — measured before/after
- Method: Lighthouse 12, mobile emulation, local prod build, Home.
- **Before:** Perf 72 · A11y 93 · BP 100 · SEO 100 (LCP 5.1s, TBT 260ms).
- **After:** **Perf 94 · A11y 100 · BP 100 · SEO 100** (LCP 3.1s, TBT 30ms, CLS 0).
- Fix: zero iframes at Home load — `BoxcastFacade` renders a themed poster and
  swaps in the real embed on tap; theme lock shed 4 Google font families.

## Accessibility (Task 4)
- The pre-lock `color-contrast` failure came from the deleted themes; gone after
  lock.
- `label-content-name-mismatch`: fixed by **removing** redundant `aria-label`s
  (header logo, clip cards, facade button) so the visible text IS the accessible
  name — per WCAG 2.5.3 the label must contain the visible text, and the visible
  text was already descriptive.
- Slider dots: 10px visuals now sit inside 24×24px buttons (WCAG 2.5.8 target size).

## Facts / banner (Task 5)
- Service times seeded from the church's old site with `TODO(owner): confirm` in
  both `seed.ts` and `seed-sanity.mjs`; Wednesday renders as two entries
  (Corporate Prayer 6:30 PM · Bible Study 7:00 PM). Canonical email remains a
  marked TODO (info@ vs hello@ is the owner's call).
- `EventBanner`: expires 24h after a parseable date; **unparseable dates never
  expire** (fail-open so a typo doesn't hide an announcement). With no live banner
  it falls back to the soonest upcoming event. Expiry evaluates at render — on the
  static preview that's build time; with Sanity connected, ISR keeps it fresh.
  (Superseded by the platform upgrade below: the `(site)` layout now sets
  `revalidate = 3600`, so the preview is no longer frozen at build time, and the
  ISR window is 300s plus the on-demand publish webhook.)
- Stale "May 8, 2024" banner removed from both seeds.

## Redirects (Task 6)
- Old post slugs + page IDs fetched live from `kingdombuilderscf.org/wp-json` —
  14 real post slugs (root-level permalinks) → 301 to `/blog`; also added
  `/get-connected` (a real old page) → `/new-here`.
- `?page_id=N` was originally handled in `middleware.ts` with a map of the real
  WP page IDs → new routes. **Superseded by the platform upgrade below:** that
  map now lives in `next.config.ts` `redirects()` via `has: [{ type: "query" }]`,
  and `middleware.ts` is gone. 1461 wasn't among the published page IDs, so it
  renders the homepage (200) rather than redirecting.
- Note: `next.config` `permanent: true` emits **308**, the modern equivalent of
  301 (search engines treat both as permanent). All redirects are now 308.

## Analytics (Task 7)
- Plausible (privacy-friendly, no cookie banner) via `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`;
  script renders only when set. Search Console via
  `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` meta tag.
- **GA4 alternative:** swap the Script tag for gtag.js keyed on `NEXT_PUBLIC_GA_ID`;
  GA4 would likely need a consent banner — Plausible avoids that entirely.

## Dead code removed (Task 8)
`page` schema + type, `upcomingEventsQuery`/`eventBySlugQuery`, the `heroVideoUrl`
chain (type/schema/query/seed), `lib/integrations/planningcenter.ts` (+ its
`next.config` image host and env vars — KBCF is CMS-native for events/groups),
the theme system (4 themes, switcher, `useTheme`), Header's unused `churchName`
prop, unused ticker CSS.

## Platform upgrade (Next 16.3 / React 19.3 / Sanity 6.13)

**Adopted**
- Next 16.2.9→16.3.4, React 19.2.4→19.3.0, Sanity 6.0→6.13.1 (+ `@sanity/vision`),
  next-sanity 13.1→13.3.4, `@portabletext/react` 6→8, Tailwind 4.3.1→4.3.3,
  lucide-react 1.18→1.44, zod 4.4→4.6, styled-components 6.4→6.5, `@types/node` 20→22.
- **Node 22.12+ is now required** (`engines` + `.nvmrc`): Sanity 6.13 and
  PortableText 8 both declare it. Vercel's Node version must be set to 22.x.
- `@sanity/icons` v5 removed its barrel export, so schema files import per-icon
  subpaths (`@sanity/icons/Calendar`). The dependency is now declared directly
  rather than relied on transitively.
- **React Compiler on** (`reactCompiler: true`, stable in 16). Build time is
  unchanged in practice and the client chunks show compiler output; the ten
  small client components memoize for free.
- **`middleware.ts` deleted.** The `?page_id=N` map moved into `redirects()`
  using `has: [{ type: "query" }]`. The deprecated `middleware` convention would
  otherwise have run a function in front of the site's most-visited route just to
  check a query param. Two consequences, both intended: mapped ids now emit 308
  (not 301) and carry the original `?page_id=` through to the destination
  (harmless — the canonical tag dedupes it), and an *unknown* id renders Home
  with 200 rather than redirecting (same destination, one less hop; a catch-all
  entry would have looped `/` → `/`).
- Cache tags on every Sanity query + `POST /api/revalidate` (shared-secret,
  constant-time compare) so publishes appear in seconds; the polling window
  relaxed 60s → 300s as the safety net.
- `export const revalidate = 3600` on the `(site)` layout: with no Sanity
  configured nothing fetches, so "upcoming events", the banner expiry and the ©
  year were otherwise frozen at build time. When Sanity is connected the
  5-minute fetch value (the lowest on the route) still wins.

**Deliberately NOT adopted**
- **TypeScript 7** (`tsc` is now the Go port). It has no stable plugin API, so
  the `plugins: [{ name: "next" }]` language-service integration doesn't work,
  and typescript-eslint still caps at `<6.1.0`. Revisit at 7.1.
- **ESLint 10.** `eslint-config-next@16.3.4` pins `typescript-eslint@^8.46`, and
  `eslint-plugin-jsx-a11y`/`eslint-plugin-import` still declare `^9` peers.
- **Cache Components / PPR.** Every page and the site layout `await` data at the
  top level with no `use cache`/Suspense, and four files read the clock; enabling
  it is a restructure, not a flag. The webhook above delivers the editorial
  benefit without it. Revisit post-launch.
- **`typedRoutes`.** `Button` forwards a plain `string` href and receives
  CMS-authored values, so it would need generics plus casts at every CMS
  boundary — poor trade for a 16-route site.

## Security, a11y and data-layer hardening (same pass)
- **Headers** on every response (HSTS, nosniff, `X-Frame-Options: DENY`,
  Referrer-Policy, Permissions-Policy). CSP ships **report-only** with a separate,
  looser policy for `/studio`: every page is prerendered, so nonces (which force
  dynamic rendering) aren't available and `'unsafe-inline'` is required for
  Next's hydration payload. `upgrade-insecure-requests` is omitted because
  Chrome ignores (and logs) it under Report-Only; add it when enforcing.
- **JSON-LD escaping** (`<` → `<`): CMS text could otherwise close the
  script tag. Also fixed the shapes Rich Results rejects — the Church object no
  longer emits free-text service times as `Schedule`, Events carry a
  `PostalAddress`, VideoObject requires a real `thumbnailUrl`, BlogPosting has
  `image`/`publisher`/`mainEntityOfPage`, and `SearchAction` uses `EntryPoint`.
- **Form notifications** moved into `after()` (the visitor no longer waits on
  Resend) and now check `res.ok`: a rejected send logs `UNDELIVERED` with the
  submission instead of silently vanishing behind a 200. Added `reply_to`, a
  cross-site/`Content-Length` guard, and single-line field validation so a name
  can't fold an email subject.
- **Sanity is now genuinely the single source of truth:** `sfetch` distinguishes
  "no Sanity" from "Sanity said zero", so deleting the last post no longer
  resurrects the seeded sample. Errors are logged (and with `CONTENT_STRICT=1`
  rethrown) instead of silently falling back. `getSiteSettings` merges per field,
  so an editor clearing one array can't crash the layout.
- **Timezone:** every date renders in `America/Los_Angeles`. The build runs in
  UTC, so the events list and calendar previously disagreed with the visitor's
  browser (a hydration mismatch) and could place an event on the wrong day.
- **A11y:** the hero slideshow is pausable and stops in background tabs (WCAG
  2.2.2); form success states are announced and take focus (4.1.3); Escape in
  the mobile menu returns focus to the toggle; the sermon page's `<h1>` precedes
  its `<h2>`; alt text is a hard Studio requirement rather than a warning.
- **Placeholder safety:** seeded sample sermons/posts/events are `noindex` and
  excluded from the sitemap, so a premature DNS cutover can't index
  "Sample Message — Edit in Studio".
- **Reveal-on-scroll** no longer hides content that is already visible at
  hydration (it could blink), and drops its `will-change` layer once revealed.
  This also removed the `beforeInteractive` script and `next/script` from every
  route that has no analytics domain set.
- Image `sizes` are explicit per call site (thumbnails were requesting up to 6×
  their rendered width), the sermon YouTube embed became a click-to-load facade,
  `priority` → `preload` (deprecated in 16), and `remotePatterns` dropped the
  dead `**.amazonaws.com`/`**.cloudfront.net` wildcards that let anyone proxy
  images through the site's optimizer.
- Known: `npm audit` reports 15 advisories, all inside the Sanity **CLI/Studio**
  toolchain (adm-zip, js-yaml, smol-toml, uuid) and none on the request path.
  They clear when Sanity ships a fixed CLI; `npm audit fix` cannot resolve them
  without a breaking downgrade.
