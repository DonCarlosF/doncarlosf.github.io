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

## 7. Non-functional (measured — Lighthouse 12, Home, mobile, prod build)
- **Perf 94 · A11y 100 · Best Practices 100 · SEO 100** (was 72/93/100/100). LCP 3.1s, TBT 30ms, CLS 0. Zoom enabled.
- SEO: per-page metadata, OG image, sitemap, robots, JSON-LD (Church/WebSite/Event/VideoObject/BlogPosting).
- **Redirects verified** (curl): `/giving`, `/livestream`, `/about/new-here`, `/about/groups`, `/get-connected`, all **14 real old post slugs** (from live wp-json) → `/blog`, and `?page_id=N` → mapped routes (1461→`/`).

## 8. Dead code
Swept (see DECISIONS.md): `page` schema, unused queries, `heroVideoUrl` chain, Planning Center module, theme system + switcher + 4 fonts, unused Header prop, ticker CSS. Build/lint/tsc clean.

---

## Top gaps to launch (human-owned)
1. **Create the Sanity project** + set env vars + run `npm run seed:sanity` (staff editing + clip upserts depend on it).
2. **Set `RESEND_API_KEY` + `STAFF_EMAIL`** so forms reach a real inbox; pick a newsletter provider.
3. **Content approvals + owner TODOs** (§6): canonical email, service-time confirmation, copy sign-off, photos, Karen bio, statement of faith.
4. **Set analytics env values** (Plausible domain, Search Console token) and verify property.
5. **Clip-manager side:** point it at the Sanity project per `CLIP_CONTRACT.md`.
6. **Cutover plan** (DNS is out of scope here): map `kingdombuilderscf.org` to Vercel only after the above; the redirect map is already live-tested.
