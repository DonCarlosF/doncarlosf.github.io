# DECISIONS.md — kbcf-clipper

Running log of concrete choices and the defaults picked where the brief left a
gap. One line of justification each, per the brief.

## Where it lives
- The tool is a self-contained Python project under `clipper/` in the church's
  site repo. It shares nothing with the Next.js app except the verified BoxCast
  channel id (`wsiikymmlhksnkgmc24r`, cross-checked against
  `lib/integrations/boxcast.ts`).

## Library choices (justification)
- **typer** — type-hint driven CLI with subcommands + good help, less boilerplate than argparse.
- **pydantic v2** — validates the Claude JSON contract, transcript, and clip sidecars at the boundary.
- **pyyaml** — config.yaml is the single source of truth; everything else stays generic.
- **requests** — tiny, reliable client for the BoxCast public REST API.
- **yt-dlp** — handles BoxCast HLS playlists *and* the Facebook fallback with one API.
- **ffmpeg/ffprobe via subprocess** — keeps the exact filtergraph visible/debuggable; `ffmpeg-python` adds a thin layer over a tool we already know.
- **whisperx** (default) + **faster-whisper** (fallback) — WhisperX gives word-level timestamps via forced alignment + diarization, which captions and snapping need.
- **mediapipe + opencv** — fast face detection for the active-speaker crop; TalkNet-ASD / AutoFlip noted as a future upgrade.
- **anthropic** — Claude moment scoring; model id from config, key from `ANTHROPIC_API_KEY`, text-only.
- **pillow** — sample the logo's dominant colors and handle thumbnails without a heavy dep.
- **jinja2** — render the self-contained review gallery.
- **ASS captions hand-written** (no lib) — full control over per-word karaoke coloring + safe-zone geometry.

## Defaults picked (spec gaps)
- **Logo missing.** `assets/kbcf-logo.png` is NOT in the repo (Facebook blocks
  automated fetch and its URLs expire — we never fetch at runtime, per the
  brief). The pipeline proceeds with the mandated fallback: a transparent
  **"KBCF" text wordmark** (top-left, emphasis color). Drop the real PNG at
  `assets/kbcf-logo.png` to switch to the image overlay automatically.
- **Brand palette fallback.** With no logo and no config overrides, captions
  use **primary `#2D1B69` (deep royal)** + **emphasis `#F2C14E` (warm gold)** —
  high-contrast, legible burned-in, and on-brand for a contemporary Black-church
  aesthetic. With a logo present, colors are sampled from it.
- **`source.select: latest_completed`** = the most recent broadcast with
  `timeframe=past` on the channel — verified live. NOTE: the newest completed
  broadcast is sometimes a midweek **Bible Study**, not the Sunday sermon. Added
  an optional `source.name_filter` (default `null`); set it to
  `"Sunday Service"` to lock onto sermons only.
- **Caption style.** White base, active word in emphasis color, bottom-center,
  `MarginV≈470` on a 1080×1920 canvas to clear platform UI; 2–3 words/line.
- **Active-word highlight** is one ASS event per word (true single-word
  emphasis) rather than a `\k` karaoke sweep — matches the brief's "active word
  in emphasis color" precisely.
- **Reframe default = static centered crop** (MVP). `--reframer face` enables
  mediapipe tracking sampled at **2 fps**, EMA **alpha 0.2**, with a centered-crop
  fallback when the track is low-confidence. Dynamic crop is emitted as a
  t-keyed ffmpeg `crop` expression so rendering stays strategy-agnostic.
- **Offline heuristic scorer.** When `ANTHROPIC_API_KEY` is unset (or
  `--mock-score`), a deterministic heuristic stands in so the full pipeline runs
  and is testable. It is clearly logged and is **not** a substitute for Claude.
- **Encoding.** H.264, `crf 18`, `preset medium`, 30 fps, `yuv420p`,
  `+faststart`, AAC 160k — broadly compatible with all vertical platforms.
- **Thumbnail** = frame at `min(2s, duration/3)` (after the hook lands).
  Real-ESRGAN upscaling left as a TODO hook for low-res sources.
- **Caching.** `transcript.json` and `candidates.json` are cached in the output
  dir; `--refresh` ignores them. Re-running later stages is cheap/deterministic.
- **`--no-render`.** Skips ffmpeg and produces captions + sidecars + gallery —
  used on boxes without ffmpeg/GPU and in CI.

## Guardrails honored
- Never auto-posts/schedules; output is a local review queue with Approve/Reject.
- Only the **text** transcript is sent to the Anthropic API — never the video.
- Scripture refs are detected only from the transcript (66-book regex); Claude is
  instructed never to fabricate references. Low-confidence transcription is flagged.
- All source video treated as KBCF-owned; no third-party scraping.

## Build/verification status in this environment
- Verified the BoxCast resolution against the **live** API (channel, latest
  completed broadcast, signed HLS `playlist`) — see README.
- Ran the pipeline end-to-end **offline** on `fixtures/sample_transcript.json`
  (heuristic scorer, `--no-render`): 4 clip sidecars + ASS + gallery. See
  `sample_output/`.
- `ffmpeg`, `whisperx`, and `mediapipe` are **not installed** in this sandbox, so
  the actual MP4 render + ASR + face-track were not executed here. Those stages
  are implemented, lazy-imported, and unit-tested for command/IO correctness.
- 26 unit tests pass (`pytest`).
