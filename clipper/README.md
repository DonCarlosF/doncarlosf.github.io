# kbcf-clipper

Turn a full KBCF sermon (BoxCast livestream VOD) into **4 vertical, captioned,
branded short-form clips** — each with a hook, caption, hashtags, Scripture
refs, and a virality score — packaged into a local **review gallery** for a
human to Approve/Reject. Nothing is ever auto-posted.

```
ingest → transcribe → score (Claude) → select+tighten → reframe 9:16
       → captions (ASS) → branding → render (ffmpeg) → package (gallery)
```

## Install

```bash
cd clipper
python3 -m pip install -r requirements.txt        # core
python3 -m pip install whisperx faster-whisper    # Stage 2 (ASR), optional/heavy
python3 -m pip install mediapipe opencv-python     # Stage 5 (face track), optional
# system binaries (NOT pip):
#   macOS:  brew install ffmpeg
#   Ubuntu: sudo apt-get install ffmpeg
export ANTHROPIC_API_KEY=sk-ant-...               # Claude scoring (text-only)
```

Or install as a command: `pip install -e .` → `kbcf-clipper ...`.

## Use

```bash
# Default: pull the latest completed KBCF broadcast and make 4 clips
kbcf-clipper run

# Local file / specific broadcast / Facebook fallback
kbcf-clipper run --file inbox/service.mp4
kbcf-clipper run --broadcast https://boxcast.tv/view/<id>
kbcf-clipper run --facebook https://www.facebook.com/kingdombuilderscf/videos/<id>

# Active-speaker vertical crop instead of static centered
kbcf-clipper run --reframer face

# Just show the latest completed broadcast on the channel
kbcf-clipper latest

# Offline / no-ffmpeg / CI: start from a transcript, heuristic scorer, no render
kbcf-clipper run --from-transcript fixtures/sample_transcript.json --mock-score --no-render
```

Output lands in `output/<broadcast_date>/`:

```
clip_01.mp4  clip_01.jpg  clip_01.ass  clip_01.json   # ...02..04
transcript.json  candidates.json  source.json  manifest.json
index.html        # the review gallery (open in a browser)
```

Open `index.html`, watch each clip, hit **Approve/Reject** (saved in the
browser), and **Export decisions.json** for your posting workflow.

## How ingest resolves a source (verified live)

The BoxCast public REST API drives the default pull (channel
`wsiikymmlhksnkgmc24r`):

1. `GET /channels/{id}/broadcasts?q=timeframe:past&s=-starts_at` → newest
   completed broadcast (optionally filtered by `source.name_filter`, e.g.
   `"Sunday Service"`).
2. `GET /broadcasts/{id}/view` → signed HLS `playlist` (`.m3u8`).
3. `yt-dlp` downloads the playlist → `.mp4`, then `ffprobe` records metadata.

Fallbacks: `inbox/` (newest local media — first-run friendly) and an explicit
`--facebook <url>`. The path taken is logged.

## Configuration

Everything tunable lives in [`config.yaml`](config.yaml): clip count/durations,
score threshold, branding (logo/colors/font), the scoring model id, output dir,
and the review-gallery toggle. Code stays generic; the config drives it.

## Architecture

| Stage | Module | Notes |
|------|--------|-------|
| 1 Ingest | `stages/ingest.py` | BoxCast REST + yt-dlp + inbox/Facebook fallbacks |
| 2 Transcribe | `stages/transcribe.py` | WhisperX (word timings + diarization); faster-whisper fallback |
| 3 Score | `stages/score.py` | Claude JSON contract (3 C's); deterministic heuristic offline fallback |
| 4 Select | `stages/select.py` | rank → snap → trim filler → enforce 30–90s → dedupe → refill to 4 |
| 5 Reframe | `stages/reframe.py` | swappable: static center / mediapipe face track (EMA smoothed) |
| 6 Captions | `stages/captions.py` | ASS, per-word emphasis, safe-zone geometry |
| 7 Branding | `stages/brand.py` | logo overlay / text wordmark, hook + re-emphasis events |
| 8 Render | `stages/render.py` | single ffmpeg filtergraph → 1080×1920 H.264 + thumbnail |
| 9 Package | `stages/package.py` | clip.json sidecars + manifest + `index.html` gallery |

Reframing is a swappable module (`get_reframer`), per the brief.

## Guardrails
- **No auto-posting** — ever. The deliverable is a local review queue; posting is
  a separate, explicit human action.
- Only the **text transcript** is sent to Anthropic — never the video.
- Scripture refs come only from the transcript; low-confidence ASR is flagged.
- All source video is treated as KBCF-owned.

## Tests
```bash
pytest          # 26 tests, no ffmpeg/GPU needed
```

See [`DECISIONS.md`](DECISIONS.md) for library choices and defaults.
