# Deploying the KBCF preview

This is a **staging/preview** deploy. Do not attach the live church domain or
point DNS — it's for review only.

## 1. Deploy to Vercel (preview)

1. Go to **vercel.com → Add New → Project** and import
   `DonCarlosF/doncarlosf.github.io` (branch `main`).
2. Framework preset auto-detects **Next.js**. No build settings to change —
   but set the **Node.js version to 22.x** (Settings → General), which the
   Sanity v6 toolchain requires.
3. Add the env vars below (all optional — the site renders on seed data without
   them), then **Deploy**. You'll get a `*.vercel.app` preview URL.

> The site builds and runs with **zero** env vars. Add them to switch on live
> content and integrations.

### Environment variables (see `.env.example`)

| Variable | Enables |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Correct metadata/sitemap/OG URLs |
| `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET` | Live CMS + `/studio` |
| `STAFF_EMAIL`, `RESEND_API_KEY` | Connect/volunteer forms → staff email |
| `SANITY_REVALIDATE_SECRET` | Publish webhook → pages refresh in seconds |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Plausible analytics (loads only when set) |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Search Console verification meta tag |

## 2. Connect Sanity (live content + `/studio`)

```bash
npm ci
npx sanity login           # opens browser
npx sanity init --env      # creates a project + writes .env (choose "production")
# copy the project id into Vercel as NEXT_PUBLIC_SANITY_PROJECT_ID
```

Seed the known facts (site settings + leadership) in one command:

```bash
# create an Editor token at sanity.io → API → Tokens
NEXT_PUBLIC_SANITY_PROJECT_ID=xxxx SANITY_WRITE_TOKEN=sk... npm run seed:sanity
```

Then staff edit everything at `your-preview-url/studio` — no code.

### Publish webhook (edits go live in seconds)

Without this, a publish takes up to 5 minutes to appear. With it, it's seconds.

1. Pick any long random string and set `SANITY_REVALIDATE_SECRET` in Vercel.
2. sanity.io → your project → **API → Webhooks → Create webhook**:
   - URL: `https://<your-site>/api/revalidate`
   - Dataset `production`; trigger on **Create, Update, Delete**
   - HTTP method `POST`; add header `x-revalidate-secret` with the same string.

**Verify:** publish a change in the Studio and reload the page — it should
update almost immediately. An unauthenticated POST to `/api/revalidate`
returns 401.

## 3. Events & groups

CMS-native: staff manage events and groups directly in the Studio.

## 4. Adding real photos (two ways)

**No-setup way (works today):** upload photos to `public/images/` using the
GitHub web UI (open the folder → *Add file → Upload files*). Specific file names
map to specific spots — see the table in `public/images/README.md`
(`pastors.jpg`, `pastor-lj.jpg`, `pastor-karen.jpg`, `dream-center.jpg`).
Vercel redeploys automatically and the photo replaces the placeholder.

**CMS way (once Sanity is connected):** upload in the Studio at `/studio`
(Home Page → Pastors photo, Leaders → image, etc.). Studio images take
precedence over the `public/images/` files.

## 5. Going to production (later, with approval)

Follow `LAUNCH.md` — it is the ordered runbook. In short: replace placeholder
copy and photos in the CMS, set the env vars above for Production, enforce the
Content-Security-Policy, then attach the domain.
