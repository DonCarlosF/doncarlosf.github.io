"""Derive caption brand colors from the logo (or fall back to KBCF defaults).

If brand colors aren't set in config, we sample the logo's dominant colors:
the most common non-neutral color becomes `primary`, and the most *vivid*
(high saturation) color becomes the caption `emphasis`.
"""
from __future__ import annotations

import colorsys
from pathlib import Path
from typing import Optional

from ..logconf import get

log = get(__name__)

# Fallback palette if the logo is missing/unreadable. Chosen to read well as
# burned-in captions: warm gold emphasis on a deep royal primary. Documented
# in DECISIONS.md; override via config branding.emphasis_color/primary_color.
DEFAULT_PRIMARY = "#2D1B69"   # deep royal
DEFAULT_EMPHASIS = "#F2C14E"  # warm gold


def _is_neutral(r: int, g: int, b: int) -> bool:
    """Near-black, near-white, or near-gray — skip as a brand color."""
    mx, mn = max(r, g, b), min(r, g, b)
    if mx < 28 or mn > 235:
        return True
    return (mx - mn) < 24  # low chroma


def _saturation(r: int, g: int, b: int) -> float:
    _, _, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return s


def rgb_to_hex(r: int, g: int, b: int) -> str:
    return f"#{r:02X}{g:02X}{b:02X}"


def hex_to_ass(hex_color: str) -> str:
    """#RRGGBB -> ASS &HAABBGGRR& (opaque alpha 00, byte-reversed)."""
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return f"&H00{b:02X}{g:02X}{r:02X}"


def derive_brand_colors(
    logo_path: Optional[Path],
    primary_override: Optional[str] = None,
    emphasis_override: Optional[str] = None,
) -> tuple[str, str]:
    """Return (primary_hex, emphasis_hex). Overrides win; else sample the logo."""
    primary = primary_override
    emphasis = emphasis_override
    if primary and emphasis:
        return primary, emphasis

    sampled_primary, sampled_emphasis = DEFAULT_PRIMARY, DEFAULT_EMPHASIS
    if logo_path and Path(logo_path).exists():
        try:
            from PIL import Image

            img = Image.open(logo_path).convert("RGBA")
            img.thumbnail((128, 128))
            counts: dict[tuple[int, int, int], int] = {}
            for r, g, b, a in img.getdata():
                if a < 200 or _is_neutral(r, g, b):
                    continue
                # bucket to 16-level cube to merge near-identical shades
                key = (r // 16 * 16, g // 16 * 16, b // 16 * 16)
                counts[key] = counts.get(key, 0) + 1
            if counts:
                most_common = max(counts.items(), key=lambda kv: kv[1])[0]
                most_vivid = max(counts.keys(), key=lambda c: _saturation(*c))
                sampled_primary = rgb_to_hex(*most_common)
                sampled_emphasis = rgb_to_hex(*most_vivid)
        except Exception as exc:  # pragma: no cover - defensive
            log.warning("Could not sample logo colors (%s); using defaults.", exc)
    else:
        log.warning("Logo not found at %s; using default brand palette.", logo_path)

    return (primary or sampled_primary, emphasis or sampled_emphasis)
