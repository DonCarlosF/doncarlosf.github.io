# Clip Contract — church-clip-manager → kbcf-website

The website **reads** Sanity `clip` documents; the clip-manager repo **writes** them
via the Sanity HTTP API using its own write token (kept in that repo's gitignored
`.env` — never in this repo). This file is the interface. Change it in both repos
or not at all.

## Document shape (`_type: "clip"`)

| Field | Type | Req | Notes |
| --- | --- | --- | --- |
| `_id` | string | ✅ | Deterministic — see convention below. |
| `_type` | `"clip"` | ✅ | |
| `hook` | string | ✅ | Short overlay text on the card. |
| `caption` | text | | Post caption. |
| `sermonDate` | date `YYYY-MM-DD` | ✅ | Rail sorts by this, newest first. |
| `scriptureRefs` | string[] | | e.g. `["John 3:16"]`. |
| `platforms` | object | | Post URLs: `{ youtube?, instagram?, tiktok? }`. YouTube enables inline play on the site; otherwise the card links to the first available URL. |
| `verticalVideo` | file (MP4) | | Optional self-hosted asset (upload asset first, then reference). |
| `thumbnail` | image (`accessibleImage`) | | Upload the image asset, then reference; include `alt`. |
| `parentSermon` | reference → `sermon` | | Optional. |
| `hashtags` | string[] | | |
| `viralityScore` | number 0–100 | | Tie-breaker sort within a date. |
| `status` | `"scheduled"` \| `"published"` | ✅ | **The site renders only `published`.** Default in Studio is `scheduled`. |

## `_id` convention (idempotent upserts)

```
clip-{sermonDate}-{slot}      // slot = 1..4
e.g. clip-2026-06-21-1, clip-2026-06-21-2, ...
```

Always write with `createOrReplace` — re-running a publish job for the same sermon
overwrites the same four documents instead of duplicating them.

## Example upsert (from the clip-manager repo)

```js
import { createClient } from "@sanity/client";
const client = createClient({ projectId, dataset: "production", token, apiVersion: "2024-10-01", useCdn: false });

// 1) upload thumbnail asset
const asset = await client.assets.upload("image", fs.createReadStream("thumb.jpg"));

// 2) upsert the clip
await client.createOrReplace({
  _id: "clip-2026-06-21-1",
  _type: "clip",
  hook: "You are not what happened to you",
  caption: "...",
  sermonDate: "2026-06-21",
  scriptureRefs: ["2 Cor 5:17"],
  platforms: { youtube: "https://www.youtube.com/shorts/XXXXXXXXXXX" },
  thumbnail: { _type: "accessibleImage", asset: { _type: "reference", _ref: asset._id }, alt: "Pastor preaching" },
  hashtags: ["#kbcf", "#oakland"],
  viralityScore: 88,
  status: "published",
});
```

## How the site renders

- `getClips()` → GROQ `*[_type == "clip" && status == "published"] | order(sermonDate desc, viralityScore desc)`.
- Rails: Watch page (all published clips), sermon detail (that sermon's clips), Home (latest sermon's clips).
- Card behavior: `platforms.youtube` → tap-to-play inline (lite facade, iframe loads on tap); else first of instagram/tiktok → external link; else static card.
- No published clips → labeled empty rail ("Clips from Sunday's message — coming soon"). The build never blocks on clips.

## Fallback (not implemented)

A `content/clips.json` manifest reader was considered and skipped — Sanity is the
single source of truth (see DECISIONS.md). If ever needed, mirror the shape above.
