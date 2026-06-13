"""Stage 8 — Render.

Assemble one ffmpeg filter_complex per clip: trim the span, apply the
9:16 crop/scale (from the reframer), burn the ASS captions+hook, overlay the
logo, and encode 1080x1920 H.264. Then grab a thumbnail still.

Real-ESRGAN upscaling hook is left as a TODO for low-res sources.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from ..logconf import get
from ..models import Clip
from ..utils import ffmpeg
from .brand import Brand, logo_overlay
from .reframe import CropPlan

log = get(__name__)


@dataclass
class RenderResult:
    video_path: Path
    thumbnail_path: Optional[Path]


def _escape_filter_path(p: Path) -> str:
    # Escape characters special to the ffmpeg filtergraph parser.
    return str(p).replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def _build_filter_complex(crop: CropPlan, ass_path: Path, brand: Brand, position: str) -> tuple[list[str], str, str]:
    """Return (extra_inputs, filter_complex, out_label).

    Stream graph: source -> crop/scale -> burn ASS -> (optional) logo overlay.
    When a logo image exists it is input #1 and overlaid; otherwise the
    branding stage already injected a text wordmark into the ASS.
    """
    ass = f"ass={_escape_filter_path(ass_path)}"
    captioned = f"[0:v]{crop.crop_filter()},{ass}"
    extra_inputs, has_logo = logo_overlay(brand)
    if has_logo:
        fc = (
            f"{captioned}[cap];"
            f"[1:v]scale=172:-1[lg];"
            f"[cap][lg]overlay={_overlay_pos(position)}[out]"
        )
        return extra_inputs, fc, "[out]"
    return [], f"{captioned}[out]", "[out]"


def _overlay_pos(position: str) -> str:
    inset = 48
    return {
        "top-left": f"{inset}:{inset}",
        "top-right": f"main_w-overlay_w-{inset}:{inset}",
        "bottom-left": f"{inset}:main_h-overlay_h-{inset}",
        "bottom-right": f"main_w-overlay_w-{inset}:main_h-overlay_h-{inset}",
    }.get(position, f"{inset}:{inset}")


def render_clip(
    source: Path,
    clip: Clip,
    crop: CropPlan,
    ass_path: Path,
    brand: Brand,
    out_dir: Path,
    *,
    logo_position: str = "top-left",
    crf: int = 18,
    fps: int = 30,
) -> RenderResult:
    out_dir.mkdir(parents=True, exist_ok=True)
    video_path = out_dir / f"clip_{clip.index:02d}.mp4"
    extra_inputs, fc, out_label = _build_filter_complex(crop, ass_path, brand, logo_position)

    args = [
        "-ss",
        f"{clip.start:.3f}",
        "-i",
        str(source),
        *extra_inputs,
        "-t",
        f"{clip.duration:.3f}",
        "-filter_complex",
        fc,
        "-map",
        out_label,
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        str(crf),
        "-pix_fmt",
        "yuv420p",
        "-r",
        str(fps),
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
        str(video_path),
    ]
    ffmpeg.run(args, desc=f"render clip {clip.index}")
    thumb = _thumbnail(video_path, out_dir / f"clip_{clip.index:02d}.jpg", clip.duration)
    return RenderResult(video_path=video_path, thumbnail_path=thumb)


def _thumbnail(video: Path, out: Path, duration: float) -> Optional[Path]:
    """Grab a representative still (after the hook lands). TODO: Real-ESRGAN upscale."""
    t = min(2.0, max(0.5, duration / 3))
    try:
        ffmpeg.run(
            ["-ss", f"{t:.2f}", "-i", str(video), "-frames:v", "1", "-q:v", "2", str(out)],
            desc="thumbnail",
        )
        return out
    except Exception as exc:  # pragma: no cover
        log.warning("Thumbnail failed: %s", exc)
        return None
