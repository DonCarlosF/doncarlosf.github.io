# Deploying the KBCF preview

This is a **staging/preview** deploy. Do not attach the live church domain or
point DNS — it's for review only.

## 1. Deploy to Vercel (preview)

1. Go to **vercel.com → Add New → Project** and import
   `DonCarlosF/doncarlosf.github.io`, branch `claude/cool-fermi-vzbnc2`.
   - One-click import URL:
     `https://vercel.com/new/clone?repository-url=https://github.com/DonCarlosF/doncarlosf.github.io/tree/claude/cool-fermi-vzbnc2`
2. Framework preset auto-detects **Next.js**. No build settings to change.
3. Add the env vars below (all optional — the site renders on seed data without
   them), then **Deploy**. You'll get a `*.vercel.app` preview URL.

> The site builds and runs with **zero** env vars. Add them to switch on live
> content and integrations.

### Environment variables (see `.env.example`)

| Variable | Enables |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Correct metadata/sitemap/OG URLs |
| `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET` | Live CMS + `/studio` |
| `PCO_APP_ID`, `PCO_SECRET` | Planning Center events + groups |
| `STAFF_EMAIL`, `RESEND_API_KEY` | Connect/contact form → staff email |
| `NEXT_PUBLIC_SHOW_THEME_SWITCHER=false` | Hides the Sanctuary/Movement preview switcher (set in production once a direction is chosen) |

## 2. Connect Sanity (live content + `/studio`)

```bash
npm install
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

## 3. Connect Planning Center (events + groups)

1. Create a Personal Access Token at
   `https://api.planningcenteronline.com/oauth/applications`.
2. Set `PCO_APP_ID` and `PCO_SECRET` in Vercel and redeploy.

Events/groups then come live from Planning Center, falling back to the CMS when
the API is unavailable.

## 4. Going to production (later, with approval)

- Replace placeholder copy (statement of faith, bios, Dream Center programs)
  and add real photos in the CMS.
- Provide the real old-site URL list to finalize redirects in `next.config.ts`.
- Add real phone/email/socials in Site Settings.
- Only then attach the production domain.
