"""Stage 7 — Branding.

Derives brand colors (from the logo or config overrides), builds the logo
overlay filter for ffmpeg, and contributes ASS events: an on-screen hook for
the first ~3s and a hook re-emphasis at ~15-18s (for silent scrollers). If
the logo file is missing, we fall back to a transparent "KBCF" text wordmark
(documented in DECISIONS.md) so the pipeline never blocks.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from ..config import Config
from ..logconf import get
from ..models import Clip
from ..utils.colors import derive_brand_colors, hex_to_ass
from .captions import AssEvent

log = get(__name__)

REEMPHASIS_START = 15.0
REEMPHASIS_END = 18.0
HOOK_INTRO_END = 3.0
HOOK_MAX_CHARS = 60


@dataclass
class Brand:
    primary_hex: str
    emphasis_hex: str
    font: str
    logo_path: Optional[Path]  # None => use text wordmark


def resolve_brand(cfg: Config) -> Brand:
    primary, emphasis = derive_brand_colors(
        cfg.logo_path if cfg.logo_path.exists() else None,
        primary_override=cfg.branding.primary_color,
        emphasis_override=cfg.branding.emphasis_color,
    )
    logo = cfg.logo_path if cfg.logo_path.exists() else None
    if logo is None:
        log.warning(
            "Logo %s missing — using 'KBCF' text wordmark (see DECISIONS.md).",
            cfg.branding.logo_path,
        )
    return Brand(primary_hex=primary, emphasis_hex=emphasis, font=cfg.branding.caption_font, logo_path=logo)


def _short_hook(hook: str) -> str:
    hook = hook.strip().strip(".")
    return hook if len(hook) <= HOOK_MAX_CHARS else hook[:HOOK_MAX_CHARS].rsplit(" ", 1)[0] + "…"


def build_brand_events(clip: Clip, brand: Brand, reemphasis: bool) -> list[AssEvent]:
    """Hook intro, optional re-emphasis, and a wordmark if there's no logo image."""
    events: list[AssEvent] = []
    hook = _short_hook(clip.hook_text or clip.caption)
    duration = clip.duration

    if hook:
        events.append(AssEvent(start=0.0, end=min(HOOK_INTRO_END, duration), text=hook, style="Hook"))
        if reemphasis and duration > REEMPHASIS_END:
            events.append(
                AssEvent(start=REEMPHASIS_START, end=min(REEMPHASIS_END, duration), text=hook, style="Hook")
            )

    if brand.logo_path is None:
        # Persistent top-left transparent wordmark, emphasis color.
        mark = f"{{\\an7}}{{\\c{hex_to_ass(brand.emphasis_hex)}}}{{\\fs56}}{{\\b1}}KBCF"
        events.append(AssEvent(start=0.0, end=duration, text=mark, style="Caption"))
    return events


def logo_overlay(brand: Brand) -> tuple[list[str], bool]:
    """Return (extra ffmpeg input args, has_logo).

    `([], False)` when using the text wordmark; otherwise the logo file is
    added as an extra ffmpeg input and `render` builds the overlay filter
    (scaled to ~16% of the 1080px width, inset within the safe zone).
    """
    if brand.logo_path is None:
        return [], False
    return ["-i", str(brand.logo_path)], True
