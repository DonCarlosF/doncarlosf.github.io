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
