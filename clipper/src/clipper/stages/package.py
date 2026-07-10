"""Stage 9 — Package for review.

Writes per-clip clip.json sidecars, a manifest.json, and a self-contained
index.html gallery that plays each clip with its metadata and an
Approve/Reject toggle. This is the human review queue — nothing auto-posts.
"""
from __future__ import annotations

import json
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from ..config import Config
from ..logconf import get
from ..models import Clip, SourceMeta

log = get(__name__)

_TEMPLATES = Path(__file__).resolve().parent.parent / "templates"


def _env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(_TEMPLATES)),
        autoescape=select_autoescape(["html"]),
    )


def package(cfg: Config, source: SourceMeta, clips: list[Clip], out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)

    # Per-clip sidecars (file references already set by the render stage).
    sidecars = []
    for clip in clips:
        sidecar_path = out_dir / f"clip_{clip.index:02d}.json"
        clip.write_sidecar(sidecar_path)
        sidecars.append(clip.sidecar())

    source.save(out_dir / "source.json")

    manifest = {
        "church": cfg.church.model_dump(),
        "broadcast": {
            "title": source.title,
            "date": source.broadcast_date,
            "id": source.broadcast_id,
            "url": source.source_url,
            "ingest_path": source.ingest_path.value,
        },
        "clip_count": len(clips),
        "clips": sidecars,
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    if cfg.output.review_gallery:
        html = _env().get_template("gallery.html.j2").render(
            church=cfg.church.model_dump(),
            broadcast=manifest["broadcast"],
            clips=sidecars,
        )
        (out_dir / "index.html").write_text(html, encoding="utf-8")
        log.info("Review gallery: %s", out_dir / "index.html")

    return out_dir
