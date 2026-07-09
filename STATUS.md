# KBCF Website — Status Audit

_Read-only inventory as of 2026-06-24 (commit `3c55c65` on `main`). Honest grading:
**BUILT** = real content/components wired to the content layer · **PARTIAL** = works but
material gaps · **STUB** = placeholder only · **MISSING** = not present._

Note on "CMS": Sanity schemas + queries are fully wired, but **no Sanity project is
connected yet** (no env vars), so every page currently renders the seed fallback in
`lib/content/seed.ts`. The moment env vars + seeded content exist, pages switch to live
CMS data with no code changes.

---

## 1. Pages / routes

| Page | Status | Notes |
| --- | --- | --- |
| Home | **BUILT** | Hero slideshow, event banner, service bar, welcome, 4 pathways, pastors, live embed + latest message, events, testimonial, Dream Center, giving — reads `homePage` singleton (seed fallback). |
| About | **BUILT** | Supplied intro/mission/Five Pillars/Core Values; "Our Story" is an intentional placeholder card. |
| Leadership | **PARTIAL** | Exists as About → `#leadership` (Dr. LJ full bio, Dr. Karen short + placeholder). No standalone route; no staff/ministry leads. |
| New Here / Plan Your Visit | **PARTIAL** | What-to-expect cards + working connect form. Copy is AI-drafted generic (see §6); no coffee/pastries, start-end-on-time, or service-length facts confirmed. Kids section removed at owner request. |
| Watch / Sermons | **BUILT** | BoxCast channel view (live + past-broadcast playlist), CMS sermon archive grid, series browse, clip rail, per-sermon pages w/ compact player. |
| Serve / Dream Center | **PARTIAL** | Page + working volunteer form BUILT; programs are 3 labeled placeholder cards. **No three-H's framing, no real outreach stats, no affordable-housing story** (those facts arrived after the page was built — not yet implemented). |
| Give | **PARTIAL** | Page BUILT, but Clover is **linked, not embedded** (see §2 — Clover blocks iframing). |
| Events + detail | **BUILT** | List/calendar toggle, detail pages w/ Event JSON-LD, registration link support; CMS-native (Planning Center is an optional, inert integration). |
| Groups + directory | **PARTIAL** | Directory UI w/ type filter + join CTA. Schema has type/schedule/location but **no leader or semester fields**; "contact the leader" is `joinUrl` or generic `/contact`. Sample data only. |
| Kids & Youth | **MISSING** | Deliberately removed 2026-06-16 at owner request ("take the KBCF kids section off completely"). The new brief asks for it again — **decision needed**. |
| Blog + post detail | **BUILT** | Fresh start (no 2016 posts), Portable Text rendering; 1 clearly-flagged sample post. |
| Contact | **BUILT** | Map + directions, prayer-line dial-in callout, working form. **Canonical email + phone NOT set** (placeholders; `siteSettings` fields exist for you to fill). |
| Other routes | — | `/search` (works over sermons+blog), `/watch/series` + `[slug]`, `/studio` (Sanity Studio, unconfigured), `/api/connect`, `/api/volunteer`, `/api/subscribe`, `opengraph-image`, `sitemap.xml`, `robots.txt`, 404. |

## 2. Integrations

| Integration | Status | Notes |
| --- | --- | --- |
| BoxCast live + archive | **WIRED** | Channel `wsiikymmlhksnkgmc24r` via `boxcast.tv/view-embed` (live player + countdown + past-broadcast playlist) on Watch + a contained version on Home. Caveat: the *site's own* sermon archive grid comes from CMS docs, not the BoxCast API — no automatic ingestion of titles/dates/speakers from BoxCast. |
| Clover pay-widget | **LINKED, not embedded** | Verified via response headers: Clover serves `Content-Security-Policy: frame-ancestors *.clover.com`, so browsers refuse to iframe it on any other domain — an embed is technically impossible with this widget. Current UX: secure "Give Now" panel opening Clover in a new tab (correct id `fab217bf-…`). To truly embed, KBCF needs Clover's hosted-button/SDK or a church-giving platform (page is structured for a drop-in swap). |
| Map + directions (Contact) | **WIRED** | Google Maps embed + directions link from `siteSettings.mapEmbedQuery`. |
| Newsletter signup | **PARTIAL** | Footer form + `/api/subscribe` exist; intentionally **not connected to any provider** — validates and server-logs only. |
| Analytics + Search Console | **MISSING** | No Plausible/GA4, no Search Console verification anywhere. |

## 3. Clip bridge (church-clip-manager → site)

- **Sanity `clip` schema: EXISTS** with `hook, caption, videoUrl, thumbnail, parentSermon(ref), platform(single), hashtags[], viralityScore`.
- **Contract mismatches (schema): MISSING** `sermonDate`, `scriptureRefs[]`, `platforms {youtube, instagram, tiktok}` (post URLs — current field is a single `platform` enum with no URL), `verticalVideo` (MP4 asset), `status (scheduled|published)`.
- **Rendering: PARTIAL.** Clip rails exist on Home, Watch, and sermon detail (`ClipRail`), reading clip docs via GROQ. But: cards are **not clickable** (thumbnail + hook only — no inline YouTube-Short playback, no platform links), rail is ordered by `viralityScore` not recency (no date field exists to sort by), and there's no `status` filter (drafts would show). Empty state: rail renders nothing when no clips exist (build never blocks) — graceful, though not a labeled placeholder rail.
- **Ingestion: MISSING (by design so far).** No `clips.json` manifest reader and no write-side here; the schema would accept HTTP upserts from the clip repo once fields align and a Sanity project exists. **DECISIONS.md does not exist.**

## 4. CMS (Sanity)

- **Objects:** `accessibleImage` (alt required), `serviceTime` (incl. phone/passcode for the prayer line), `socialLink`.
- **Singletons:** `siteSettings`, `homePage`, `aboutPage` (all in the Studio desk).
- **Documents:** `sermon`, `clip`, `series`, `speaker`, `event`, `group`, `leader`, `blogPost`, `testimonial`, `page`.
- **Missing vs. the new brief:** `outreachProgram` (Dream Center programs are currently uneditable placeholders); `group` lacks leader/semester fields; `clip` gaps per §3. `page` (generic blocks) is registered but **never queried or rendered** — dead schema.
- **Per-page source today:** every page = seed fallback (no project connected). All content getters (`getSiteSettings/getHomePage/getAboutPage/getSermons/getEvents/getGroups/getLeaders/getBlogPosts/getTestimonials/getClips`) prefer Sanity and fall back per-field/per-list to seed. `scripts/seed-sanity.mjs` is current with all approved copy and is idempotent.

## 5. Forms

| Form | API route | Submissions go to |
| --- | --- | --- |
| Connect ("let us know you're coming") | `POST /api/connect` | Resend email to `STAFF_EMAIL` **iff** `RESEND_API_KEY`+`STAFF_EMAIL` env set; otherwise **server log only**. Never emails the visitor. Honeypot + zod. |
| Volunteer (Dream Center) | `POST /api/volunteer` | Same pattern (staff email or server log). |
| Newsletter (footer) | `POST /api/subscribe` | **Server log only** — no provider connected, no email stored anywhere durable. |
| Search | GET `/search` | No backend — filters CMS/seed content server-side. |

⚠️ In the current preview (no env vars), **all form submissions land in server logs only** — nothing reaches a staff inbox yet. There is no dedicated prayer-request form (Contact form doubles for it).

## 6. AI-authored / unapproved content to flag for pastoral review

**Supplied by you, implemented verbatim — still needs pastoral sign-off:** hero slide messages ("God says you are enough" / "You belong here" / "Watch online"); welcome body; mission lines; pastors snippet; Dr. LJ full bio; Dr. Karen one-liner; **Five Pillars of Christianity** (incl. the 2 Tim 3:16-17 quotation); **six Core Values**; **"Brenda H." testimonial**; Dream Center volunteer paragraph; "Corporate Prayer & Bible Study — May 8, 2024" banner (**date is stale**).

**AI-drafted (by me) — replace or approve before launch:**
- New Here "what to expect" cards — includes **unverified factual claims**: "about 90 minutes," parking availability/greeters, welcome-area details.
- All section headings/intros ("Your first Sunday, made simple," "Lives changed here," "There's always something happening," "We saved you a seat," etc.), pathway card blurbs, giving-page copy ("Make it recurring," "Secure & accountable"), About closing CTA, form success/help microcopy, meta descriptions, OG-image text, footer/empty-state copy.
- Seed event descriptions (Saturday/Sunday/Wednesday blurbs) and everything labeled "Sample — Edit in Studio" (sermons, series, group, blog post, clips).
- Hero slide eyebrows/CTA labels (adapted from your slideshow messaging, not verbatim).

**Facts in the new brief that CONFLICT with what's live:** service times (site: Sun 9:00 AM, Sat Morning Prayer no time, Wed Bible Study 7:00 only — brief: Sun 9:00–10:45, Sat 9:00 AM, Wed Corporate Prayer 6:30 + Bible Study 7:00); phone `(510) 326-2446` and Facebook URL not yet in `siteSettings`; canonical email unset; Dream Center stats (500+ households, 25k lbs, 1,000+ turkeys, 700+ backpacks, ~40-unit housing) **absent from the site** — never invented, now available to add. No statistics anywhere on the site were fabricated.

## 7. Non-functional

- **Lighthouse (measured, Home, mobile emulation, local prod build):** Performance **72** · Accessibility **93** · Best Practices **100** · SEO **100**. LCP 5.1 s (hero + two BoxCast iframes on Home are the main drag), TBT 260 ms, CLS 0.
- **Perf risks:** two BoxCast iframes on the homepage (hero-adjacent Latest Message embed), 6 Google-font families loaded for the 5-theme preview (drops to 2 when a direction is locked), theme-switcher JS.
- **Accessibility:** zoom is **NOT disabled** (viewport leaves `userScalable` on — old-site bug not repeated). Skip link, labels, alt/aria patterns, reduced-motion, inert hidden slides all in place. Lighthouse flags three items to fix: **color-contrast** (at least one token combo below AA), **label-content-name-mismatch**, **target-size** (slider dots ~10 px). No captions strategy for videos yet (BoxCast-side).
- **SEO:** per-page `metadata` ✓, generated OG image ✓, `sitemap.xml` (incl. series) ✓, `robots.txt` ✓, JSON-LD: `Church` + `WebSite` (sitewide), `Event` (event pages), `VideoObject` (sermon pages), `BlogPosting` (posts) ✓. NAP consistent but **phone/email are placeholders** — local-SEO NAP incomplete until set.
- **Redirects:** 15 educated-guess 301s exist (`/giving`, `/livestream`, `/sermons`, `/about-us`, `/plan-your-visit`, `/dreamcenter`, etc.). **Missing from the old-WordPress list:** `/about/new-here/`, `/about/groups/`, `?page_id=1461` (query-string rule), and old post slugs (need the real list). Trailing-slash variants are handled by Next automatically.

## 8. Dead / unused code

- `sanity/schemaTypes/misc.ts` → `page` document type: registered, never queried/rendered.
- `lib/content/queries.ts` → `upcomingEventsQuery`, `eventBySlugQuery`: exported, never used (events resolve through `getEvents()`).
- `siteSettings.heroVideoUrl` (type + schema + query + seed): **orphaned** — the old `Hero` consumed it; `HeroSlider` does not. (Old `Hero.tsx` itself was already deleted.)
- `lib/integrations/planningcenter.ts`: inert unless PCO env vars are set — KBCF doesn't use PCO; removable.
- `useTheme().toggle`: exported, unused.
- 4 of 5 themes + `ThemeSwitcher` + 4 font families become removable once Sanctuary is locked (per the new brief).
- Seed "Sample — Edit in Studio" content (sermons, series, group, blog post, clips) — intentional, clearly flagged, replaced by CMS content when connected.

---

## Top gaps to launch

1. **Connect Sanity** (project + env vars + run `scripts/seed-sanity.mjs`) — until then, staff can't edit anything and forms/CMS run on fallbacks.
2. **Wire forms to a real inbox** (`RESEND_API_KEY` + `STAFF_EMAIL`) — submissions currently stop at server logs.
3. **Dream Center rebuild to the new facts** — three H's, real program stats, affordable-housing story, `outreachProgram` schema (needs the newly supplied facts implemented).
4. **Clip contract alignment** — extend the `clip` schema (platforms/status/sermonDate/verticalVideo), make clip cards playable/linkable, sort by recency, filter `published`; then the clip-manager can upsert via the Sanity API.
5. **Facts + NAP pass** — set canonical email, phone, socials, corrected service times; refresh/disable the stale May 8, 2024 banner.
6. **Content approvals** — §6 list (pillars/values/testimonial/bios verbatim sign-off; replace AI-drafted New Here claims).
7. **Perf + a11y polish** — get Home LCP under control (defer/facade the BoxCast embeds), fix the 3 Lighthouse a11y flags; lock a theme to shed 4 font families.
8. **Redirect map** — add `/about/new-here/`, `/about/groups/`, `?page_id=1461`, and the real old post slugs.
9. **Kids & Youth decision** — currently removed at owner request; the new brief asks for it.
10. **Analytics + Search Console** — nothing is instrumented.
