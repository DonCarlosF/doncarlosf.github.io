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
  static preview that's build time; with Sanity connected, ISR (60s) keeps it fresh.
- Stale "May 8, 2024" banner removed from both seeds.

## Redirects (Task 6)
- Old post slugs + page IDs fetched live from `kingdombuilderscf.org/wp-json` —
  14 real post slugs (root-level permalinks) → 301 to `/blog`; also added
  `/get-connected` (a real old page) → `/new-here`.
- `?page_id=N` handled in `middleware.ts` with a map of the real WP page IDs →
  new routes (unknown ids → `/`); matcher limited to `/` since WP page_id links
  are always root-relative. 1461 wasn't among the published page IDs → falls to `/`.
- Note: `next.config` `permanent: true` emits **308**, the modern equivalent of
  301 (search engines treat both as permanent); the middleware rules emit literal
  301s.

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
