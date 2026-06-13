"""End-to-end orchestrator wiring the nine stages together.

Intermediate artifacts (transcript.json, candidates.json) are cached in the
output dir so any stage can be re-run cheaply. `no_render=True` skips the
ffmpeg burn (useful on boxes without ffmpeg / a GPU) while still producing
captions, sidecars, and the gallery.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from .config import Config
from .logconf import get
from .models import Clip, MomentCandidate, Transcript
from .stages import brand as brand_stage
from .stages import captions as cap
from .stages import ingest as ingest_stage
from .stages import package as package_stage
from .stages import reframe as reframe_stage
from .stages import render as render_stage
from .stages import score as score_stage
from .stages import select as select_stage
from .stages import transcribe as transcribe_stage
from .utils import ffmpeg

log = get(__name__)

DEFAULT_W, DEFAULT_H = 1920, 1080


@dataclass
class RunOptions:
    file: Optional[str] = None
    broadcast: Optional[str] = None
    facebook: Optional[str] = None
    reframer: str = "static"
    asr_backend: str = "whisperx"
    mock_score: Optional[bool] = None  # None => auto (mock when no API key)
    no_render: bool = False
    refresh: bool = False  # ignore cached transcript/candidates


def _captions_and_brand_ass(cfg, clip, transcript, brand, out_dir) -> Path:
    """Build the merged ASS (word captions + hook/re-emphasis/wordmark)."""
    words = [w for w in transcript.words if w.end > clip.start and w.start < clip.end]
    cap_events = cap.build_caption_events(words, clip.start, brand.emphasis_hex)
    brand_events = brand_stage.build_brand_events(clip, brand, cfg.clips.hook_reemphasis)
    styles = [cap.caption_style(brand.font), cap.hook_style(brand.font, _ass(brand.emphasis_hex))]
    ass_path = out_dir / f"clip_{clip.index:02d}.ass"
    cap.render_ass(ass_path, styles, cap_events + brand_events)
    return ass_path


def _ass(hex_color: str) -> str:
    from .utils.colors import hex_to_ass

    return hex_to_ass(hex_color)


def run(cfg: Config, opts: RunOptions) -> Path:
    # 1) Ingest -------------------------------------------------------------
    source = ingest_stage.ingest(
        cfg, file=opts.file, broadcast=opts.broadcast, facebook=opts.facebook
    )
    out_dir = cfg.output_dir(source.broadcast_date)
    out_dir.mkdir(parents=True, exist_ok=True)

    # 2) Transcribe (cached) ------------------------------------------------
    transcript_cache = out_dir / "transcript.json"
    transcript = transcribe_stage.transcribe(
        source.local_path,
        backend=opts.asr_backend,
        cache_path=None if opts.refresh else transcript_cache,
    )
    transcript.save(transcript_cache)

    return _from_transcript(cfg, source, transcript, out_dir, opts)


def run_from_transcript(cfg: Config, transcript_path: Path, opts: RunOptions) -> Path:
    """Offline entry: start from an existing transcript (skip ingest+ASR)."""
    from .models import SourceMeta, IngestPath

    transcript = Transcript.load(transcript_path)
    source = SourceMeta(
        ingest_path=IngestPath.file,
        local_path=Path(opts.file or transcript_path),
        title=transcript_path.stem,
        broadcast_date="transcript",
    )
    out_dir = cfg.output_dir(source.broadcast_date)
    return _from_transcript(cfg, source, transcript, out_dir, opts)


def _from_transcript(cfg, source, transcript, out_dir, opts) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)

    # 3) Score (cached) -----------------------------------------------------
    cand_cache = out_dir / "candidates.json"
    if cand_cache.exists() and not opts.refresh:
        candidates = [MomentCandidate.model_validate(c) for c in json.loads(cand_cache.read_text())]
        log.info("Loaded %d cached candidates.", len(candidates))
    else:
        candidates = score_stage.score_transcript(cfg, transcript, mock=opts.mock_score)
        cand_cache.write_text(
            json.dumps([c.model_dump(mode="json") for c in candidates], indent=2), encoding="utf-8"
        )

    # 4) Select + tighten ---------------------------------------------------
    clips: list[Clip] = select_stage.select(cfg, candidates, transcript)

    # 5-8) Reframe + captions + branding + render --------------------------
    brand = brand_stage.resolve_brand(cfg)
    reframer = reframe_stage.get_reframer(opts.reframer)
    can_render = (not opts.no_render) and ffmpeg.available()
    if not can_render and not opts.no_render:
        log.warning("ffmpeg not available — skipping render; producing captions+sidecars only.")

    src_w = source.width or DEFAULT_W
    src_h = source.height or DEFAULT_H
    for clip in clips:
        ass_path = _captions_and_brand_ass(cfg, clip, transcript, brand, out_dir)
        clip.captions_file = ass_path.name
        if can_render:
            crop = reframer.plan(
                source.local_path, clip.start, clip.end, src_w, src_h, clip.aspect_ratio
            )
            rr = render_stage.render_clip(
                source.local_path, clip, crop, ass_path, brand, out_dir,
                logo_position=cfg.branding.logo_position,
            )
            clip.video_file = rr.video_path.name
            clip.thumbnail_file = rr.thumbnail_path.name if rr.thumbnail_path else None

    # 9) Package ------------------------------------------------------------
    package_stage.package(cfg, source, clips, out_dir)
    log.info("Done: %d clip(s) in %s", len(clips), out_dir)
    return out_dir
