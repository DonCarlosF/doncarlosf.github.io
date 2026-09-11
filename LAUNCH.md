# LAUNCH.md — KBCF Website Cutover Runbook

Ordered, do-in-sequence runbook from "preview site" to "live at kingdombuilderscf.org".
Nothing in this file has been executed — every step below is for a human to run.
**Owner key:** `CHURCH` = pastor/owner decision or account access · `EDITOR` = whoever
manages the site (you) · `DONE` = already completed in the repo.

---

## 0. Already done (no action)

| Item | Owner | Verified how |
| --- | --- | --- |
| Site built (16 routes), CMS-first with seed fallback | DONE | build green, 29 routes |
| Lighthouse Home mobile: Perf 94 · A11y 100 · BP 100 · SEO 100 | DONE | measured on prod build |
| Redirect map incl. 14 real old WordPress post slugs + `?page_id=N` middleware | DONE | curl-verified |
| Clip contract (`CLIP_CONTRACT.md`), playable rail, published-only filter | DONE | inline play verified |
| Dream Center: three H's, real stats, housing story, volunteer form | DONE | rendered + spot-checked |
| Forms with spam protection, env-gated staff notify | DONE | API routes tested |

## 1. Create the Sanity project — EDITOR · ~15 min

1. sanity.io → sign up (free) → **Create project** (dataset `production`); copy the **Project ID**.
2. Project → API → **CORS origins**: add the Vercel URL (allow credentials). Later, add `https://kingdombuilderscf.org` too.
3. Project → API → **Tokens**: create an **Editor** token (for seeding only — not a Vercel env var).
4. In Vercel → Settings → Environment Variables, set the two `NEXT_PUBLIC_SANITY_*` vars (table in §2) → **Redeploy**.
5. Locally (or any machine with Node): `NEXT_PUBLIC_SANITY_PROJECT_ID=xxx SANITY_WRITE_TOKEN=sk... npm run seed:sanity`

**Verify:** `your-site/studio` opens and shows Site Settings / Home Page / About Page filled with the approved copy; editing a field and publishing changes the site within ~1 min. **Then revoke the seeding token** (API → Tokens → delete).

## 2. Environment variables (complete list) — EDITOR · ~10 min

Set in Vercel → Project → Settings → Environment Variables (Production):

| Variable | Value | Required for |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `https://kingdombuilderscf.org` | canonical URLs, sitemap, OG |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | from §1 | CMS + `/studio` |
| `NEXT_PUBLIC_SANITY_DATASET` | `production` | CMS |
| `NEXT_PUBLIC_SANITY_API_VERSION` | `2024-10-01` | CMS (optional, has default) |
| `STAFF_EMAIL` | the inbox that receives form submissions | connect + volunteer forms |
| `STAFF_FROM_EMAIL` | verified Resend sender | form notifications |
| `RESEND_API_KEY` | from §3 | form notifications |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | `kingdombuilderscf.org` | analytics (§5) |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | token from Search Console (§5) | Search Console |

Not env vars here: the Sanity **write token** (seeding only, then revoked) and the
clip-manager's token (lives in that repo's gitignored `.env`).

**Verify:** redeploy, then view page source — canonical URLs use the real domain.

## 3. Wire forms to a real inbox — EDITOR · ~20 min

1. Create a free Resend account (resend.com), verify a sending domain or use their onboarding sender.
2. Set `RESEND_API_KEY`, `STAFF_EMAIL`, `STAFF_FROM_EMAIL` in Vercel → redeploy.

**Verify:** submit the Connect form (`/new-here#connect`) and the Volunteer form
(`/dream-center#volunteer`) with test data — both emails arrive at `STAFF_EMAIL`.
Until this step, submissions only reach server logs.

## 4. Content pass — CHURCH (approvals) + EDITOR (entry) · 1–3 hrs spread over days

All editing happens in `/studio` (see STAFF-GUIDE.md). Checklist:

- [ ] **Canonical email** — CHURCH decides info@ vs hello@; EDITOR sets Site Settings → email. *(Currently a marked TODO.)*
- [ ] **Service times confirmed** — CHURCH confirms Sat 9:00 AM · Sun 9:00–10:45 AM · Wed 6:30 + 7:00 PM (seeded from the old site with `TODO(owner)`).
- [ ] **Pastoral sign-off** on: Five Pillars, Core Values, mission/welcome/pastors copy, hero slides, Brenda H. testimonial (all implemented verbatim from the supplied doc).
- [ ] **Replace/approve AI-drafted copy** flagged in STATUS.md §6 — especially New Here's "about 90 minutes" and parking claims.
- [ ] **Statement of faith / Our Story** — CHURCH supplies; EDITOR pastes into About Page (placeholders render until then).
- [ ] **Dr. Karen extended bio** — CHURCH supplies.
- [ ] **Real photos** — upload in Studio, or drop files per `public/images/README.md` (`pastors.jpg`, `pastor-lj.jpg`, `pastor-karen.jpg`, `dream-center.jpg`).
- [ ] **Real events + groups** entered; sample "Edit in Studio" docs deleted.

**Verify:** browse every page — zero "[Placeholder…]" or "Sample — Edit in Studio" text visible.

## 5. Analytics + Search Console — EDITOR · ~15 min

1. Plausible: add the site (paid after trial — CHURCH approves the ~$9/mo, or skip; the site works without it). Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`.
2. Search Console: add property → choose HTML-tag verification → put the token in `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` → redeploy → click Verify. After DNS cutover, submit `https://kingdombuilderscf.org/sitemap.xml`.

**Verify:** Plausible dashboard shows your own visit; Search Console shows "verified".

## 6. Clip manager hookup — EDITOR (other repo) · ~30 min

Point `church-clip-manager` at the Sanity project per `CLIP_CONTRACT.md`
(project ID + its own Editor token in that repo's `.env`; `_id: clip-{sermonDate}-{slot}`;
set `status: "published"` on approved clips).

**Verify:** an approved clip appears on `/watch` and plays inline; delete the seeded
sample clips in Studio once real ones exist.

## 7. Pre-cutover QA — EDITOR · ~30 min

- [ ] Lighthouse on the Vercel URL (mobile): Perf ≥90, A11y ≥95 — expect ≈94/100.
- [ ] Redirect spot-checks (should 301/308 to the new pages):
  `curl -sI https://<vercel-url>/giving | head -3` · same for `/livestream`,
  `/about/new-here`, `/the-power-of-the-tongue`, `/?page_id=1461`.
- [ ] Forms deliver (§3), giving link opens the correct Clover page, BoxCast plays,
  prayer-line number taps correctly on a phone.
- [ ] Phone test at 360px width; zoom works.

## 8. DNS cutover — CHURCH approves and executes · ~30 min + propagation

**Written for the church to run themselves. Do this midweek in the morning — never
on a Saturday night or Sunday.**

1. **Before touching anything:** log into the domain registrar for
   `kingdombuilderscf.org`, open DNS records, and **screenshot/export every record**.
   That screenshot is the rollback plan.
2. (Optional, 24h ahead) lower the TTL on the `A`/`CNAME` records to 300s so changes
   propagate fast.
3. In Vercel → Project → Settings → **Domains** → add `kingdombuilderscf.org` and
   `www.kingdombuilderscf.org`. Vercel displays the exact records it wants — typically:
   - `A` record, host `@` → `76.76.21.21`
   - `CNAME`, host `www` → `cname.vercel-dns.com`
4. At the registrar, replace the existing `A`/`CNAME` for `@` and `www` with the
   values Vercel showed. **Change nothing else** (leave MX/email records untouched —
   this is what keeps church email working).
5. Wait for Vercel's Domains page to show both domains "Valid". Propagation:
   minutes to a few hours.

**Verify:** `https://kingdombuilderscf.org` loads the new site with a padlock (Vercel
issues SSL automatically); an old link like `kingdombuilderscf.org/giving` lands on
`/give`; email still sends/receives.

**Rollback (~5 min + propagation):** at the registrar, restore the `A`/`CNAME`
records from the step-1 screenshot. The old WordPress site is untouched by this
process and comes straight back. Nothing on Vercel needs to be undone.

## 9. Post-cutover — EDITOR · ~15 min

- [ ] Search Console: submit the sitemap; watch Coverage for 404s the first week.
- [ ] Update the Sanity CORS origins with the production domain (§1.2).
- [ ] Confirm `NEXT_PUBLIC_SITE_URL` is the production domain and redeploy once.
- [ ] Old WordPress hosting: keep it paid/parked for 30 days as a safety net, then cancel — CHURCH decision.
