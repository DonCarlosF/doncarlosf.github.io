# KBCF Website — Status

_Re-graded after the gap-close pass (Tasks 1–9). Grading: **BUILT** = real
content/components wired to the content layer · **PARTIAL** = works but material
gaps · **STUB** = placeholder only · **MISSING** = not present._

Sanity is still **not connected** (no env vars), so pages render the seed
fallback; every getter switches to live CMS data automatically once the project
+ env vars exist.

## 1. Pages / routes

| Page | Status | Notes |
| --- | --- | --- |
| Home | **BUILT** | Hero slideshow, event banner (auto-expiring, event fallback), service bar, welcome, pathways, pastors, click-to-load live facade, clips, events, testimonial, Dream Center (3 H's + 500+ stat), giving. |
| About | **BUILT** | Supplied intro/mission/Five Pillars/Core Values; "Our Story" intentionally placeholder. |
| Leadership | **PARTIAL** | Lives at About `#leadership` (Dr. LJ full bio; Dr. Karen extended bio pending). No staff/ministry leads yet. |
| New Here / Plan Your Visit | **PARTIAL** | Working connect form; what-to-expect copy is AI-drafted and awaits approval (see §6). |
| Watch / Sermons | **BUILT** | BoxCast live + past-broadcast playlist, CMS sermon archive, series browse, playable clip rail, per-sermon pages. |
| Serve / Dream Center | **BUILT** | Three H's, 8 owner-supplied programs w/ real stats, ~40-unit Eastmont/MacArthur housing story, working volunteer form. |
| Give | **BUILT** | Clover link-out by locked decision (embed impossible: `frame-ancestors *.clover.com`); structured for a future platform swap. |
| Events + detail | **BUILT** | CMS-native list/calendar/detail with Event JSON-LD. |
| Groups + directory | **PARTIAL** | Directory + filter + join CTA; schema still lacks leader/semester fields; sample data only. |
| Kids & Youth | **REMOVED (locked)** | Owner's 2026-06-16 instruction stands. |
| Blog + detail | **BUILT** | Fresh start, Portable Text; 1 flagged sample post. |
| Contact | **BUILT** | Map/directions, prayer line, working form, phone set; **canonical email = owner TODO**. |
| Other | — | `/search`, `/watch/series[/slug]`, `/studio`, 3 API routes, OG image, sitemap, robots, 404, `middleware` (WP `page_id` 301s). |

## 2. Integrations
- **BoxCast** — WIRED (channel `wsiikymmlhksnkgmc24r`): full view on `/watch`; Home uses a click-to-load facade (zero iframes at load).
- **Clover** — LINKED by locked decision (id `fab217bf-…` verified); embed technically impossible.
- **Map/directions** — WIRED. **Newsletter** — UI + API, provider intentionally unconnected. **Analytics** — Plausible + Search Console meta, env-gated (set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` / `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`).

## 3. Clip bridge
- **Read side BUILT to contract** (`CLIP_CONTRACT.md`): schema has `sermonDate` (req), `scriptureRefs`, `platforms{youtube,instagram,tiktok}`, `verticalVideo`, `status`; rail = published-only, newest-first, inline YouTube play (verified: tap loads `youtube-nocookie` embed), platform link-out fallback, labeled empty state.
- **Write side** = church-clip-manager's job (deterministic `_id: clip-{sermonDate}-{slot}`, `createOrReplace`). Needs a Sanity project + write token in *that* repo.

## 4. CMS
Objects `accessibleImage/serviceTime/socialLink`; singletons `siteSettings/homePage/aboutPage`; documents `sermon/clip/series/speaker/event/group/leader/outreachProgram/blogPost/testimonial`. Dead `page` schema removed. All pages: CMS-first with seed fallback; `scripts/seed-sanity.mjs` is current (one idempotent command once env vars exist).

## 5. Forms
Connect → `/api/connect`; Volunteer → `/api/volunteer` (both: Resend→`STAFF_EMAIL` when env set, else server log; honeypot+zod). Newsletter → `/api/subscribe` (log only until a provider is chosen). ⚠️ Without env vars, submissions stop at server logs.

## 6. Content needing human/pastoral action
- **Approve verbatim-implemented copy:** Five Pillars (+2 Tim 3:16-17), Core Values, mission/welcome/pastors copy, bios, Brenda H. testimonial, hero slide messages.
- **Replace/approve AI-drafted copy:** New Here what-to-expect cards (incl. unverified "about 90 minutes", parking claims), section headings/intros, giving-page blurbs, form microcopy, meta descriptions, three-H's card blurbs, program one-liners.
- **Owner TODOs in code:** canonical email (info@ vs hello@), confirm service times (`TODO(owner)` in seeds), Dr. Karen extended bio, statement-of-faith/Our Story text, real photos (`public/images/README.md` or Studio).

## 7. Non-functional (measured — Lighthouse 13, mobile, prod build)
| Page | Perf | A11y | BP | SEO | LCP | TBT |
| --- | --- | --- | --- | --- | --- | --- |
| Home | 92 | 100 | 100 | 100 | 3.3s | 30ms |
| Watch | 91 | 100 | 100 | 100 | 2.4s | 70ms |
| Events | 95 | 100 | 100 | 100 | 2.9s | 50ms |
| Dream Center | 98 | 100 | 100 | 100 | 2.3s | 80ms |

CLS 0 everywhere; zoom enabled. Page weight is down ~11KB per route (the italic
display font now loads on Home only). Home's Perf moved 94→92 and LCP 3.1→3.3s
inside normal run-to-run variance on this sandbox; Watch (+3) and Dream Center
(+3) improved from the YouTube facade and image `sizes` work.

- **Tested, not just measured:** `npm run test:e2e` runs 71 Playwright checks in
  CI — every route renders with one `<h1>`, a title, no console errors and no
  failed same-origin requests; axe (WCAG 2.1 AA tags) passes on every page; the
  redirect map, the form APIs and the revalidate auth are asserted.
- SEO: per-page metadata + Open Graph (pages no longer inherit the site-wide
  OG title), canonical URLs, sitemap (placeholders and `/search` excluded),
  robots, JSON-LD (Church/WebSite/Event/VideoObject/BlogPosting).
- Security headers on every response (HSTS, nosniff, `X-Frame-Options: DENY`,
  Referrer-Policy, Permissions-Policy) plus a **report-only** CSP to enforce at
  launch (`LAUNCH.md` §7).
- **Redirects verified** (curl + e2e): path redirects emit 308; `?page_id=N` is
  now a declarative `has: query` redirect (no proxy/middleware in front of Home);
  unknown ids render Home instead of redirecting.

## 8. Platform
Next.js 16.3 + React 19.3 + Sanity 6.13 on Node 22 (`.nvmrc`, `engines`), React
Compiler on, `middleware.ts` retired for declarative redirects. CI runs
lint + typecheck + build + e2e on every push. See DECISIONS.md → "Platform
upgrade" for what was deliberately *not* adopted (TypeScript 7, ESLint 10,
Cache Components, typedRoutes).

## 9. Dead code
Swept (see DECISIONS.md): `page` schema, unused queries, `heroVideoUrl` chain, Planning Center module, theme system + switcher + 4 fonts, unused Header prop, ticker CSS, the unused `urlFor` image builder + `@sanity/image-url`, the 26KB boilerplate favicon. Build/lint/tsc/e2e clean.

---

## Top gaps to launch (human-owned)
1. **Create the Sanity project** + set env vars + run `npm run seed:sanity` (staff editing + clip upserts depend on it).
2. **Set `RESEND_API_KEY` + `STAFF_EMAIL`** so forms reach a real inbox; pick a newsletter provider.
3. **Content approvals + owner TODOs** (§6): canonical email, service-time confirmation, copy sign-off, photos, Karen bio, statement of faith.
4. **Set analytics env values** (Plausible domain, Search Console token) and verify property.
4b. **Enforce the CSP** after watching the report-only console (`LAUNCH.md` §7), and set `SANITY_REVALIDATE_SECRET` + the Sanity publish webhook.
5. **Clip-manager side:** point it at the Sanity project per `CLIP_CONTRACT.md`.
6. **Cutover plan** (DNS is out of scope here): map `kingdombuilderscf.org` to Vercel only after the above; the redirect map is already live-tested.
