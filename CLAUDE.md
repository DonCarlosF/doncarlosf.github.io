# KBCF website — Claude Code entry

Kingdom Builders Christian Fellowship (Oakland, CA) public site. **Canonical agent rules live in [`AGENTS.md`](AGENTS.md).** Cursor Cloud Projects also load [`.cursor/rules/kbcf.mdc`](.cursor/rules/kbcf.mdc). Read those before changing code.

## Stack

Next.js **16** App Router · React 19 · TypeScript · Tailwind CSS **v4** (`@theme` tokens in `app/globals.css`) · Sanity CMS (embedded Studio at `/studio`) · Vercel.

Sanity is **not required** to run. Pages use `lib/content/*` (CMS-first, **seed fallback** in `lib/content/seed.ts`).

## How to run

```bash
npm install
cp .env.example .env.local   # optional — preview works with zero env vars
npm run dev                  # http://localhost:3000
npm run lint
npm run build
```

There is **no test suite**. Verify with lint + production build; for UI, hit the affected routes.

## Directory map

| Path | Role |
| --- | --- |
| `app/(site)/` | Public routes (RSC pages) |
| `app/studio/` | Embedded Sanity Studio |
| `app/api/` | `connect`, `volunteer`, `subscribe` |
| `app/globals.css` | Locked **Sanctuary** design tokens |
| `components/` | UI, blocks, forms, watch/give/events |
| `lib/content/` | Unified content API + seed |
| `lib/integrations/boxcast.ts` | BoxCast embed helpers |
| `sanity/` | Studio config + schemas |
| `scripts/seed-sanity.mjs` | Idempotent CMS seed (`npm run seed:sanity`) |
| `public/images/` | Optional zero-setup photos (see that folder’s README) |

**Routes:** `/` `/about` `/new-here` `/watch` `/watch/[slug]` `/watch/series[/slug]` `/give` `/events[/slug]` `/groups` `/dream-center` `/blog[/slug]` `/contact` `/search` `/studio`. Kids & Youth is **removed (locked)** — do not restore.

## Do

- Keep placeholders **visibly labeled** (`sample`, `placeholder`, `TODO(owner)`).
- Use semantic tokens (`bg`, `surface`, `primary`, `accent`, `cta`, `muted`, `fg`) and `components/ui/*`.
- Fall back gracefully when Sanity / Resend / analytics env is missing.
- Preserve a11y: skip link, visible focus, required alt, `prefers-reduced-motion`, **never disable zoom**.

## Don’t

- Invent doctrine, testimonials, stats, quotes, photos, contact facts, or “approved” copy.
- Attach production DNS or treat this as a live cutover (`LAUNCH.md` is human-owned).
- Commit `.env*` (except `.env.example`) or any token.
- Reintroduce the theme switcher, Planning Center, or a Kids & Youth section without an explicit owner decision.
- Change `CLIP_CONTRACT.md` unless the clip-manager repo changes in lockstep.
- Email form submitters; notify **staff only** via Resend.

## Content / CMS

Staff edit at `/studio` once `NEXT_PUBLIC_SANITY_PROJECT_ID` is set. Until then, seed data is the preview. Clip documents are **read** here and **written** by `church-clip-manager` (`CLIP_CONTRACT.md`). Site renders only `status === "published"` clips.

## Deploy

**Staging/preview only.** Import on Vercel, optional env from `.env.example`, `*.vercel.app`. Do **not** add `kingdombuilderscf.org`.

## Docs (trust order)

Code + [`DECISIONS.md`](DECISIONS.md) + [`STATUS.md`](STATUS.md) beat older overview text. [`README.md`](README.md) is useful but **stale** on themes (Sanctuary is locked; switcher deleted) and Planning Center (removed). Also: [`DEPLOY.md`](DEPLOY.md), [`LAUNCH.md`](LAUNCH.md), [`STAFF-GUIDE.md`](STAFF-GUIDE.md), [`CLIP_CONTRACT.md`](CLIP_CONTRACT.md). `design/` is historical mockups.

@AGENTS.md
