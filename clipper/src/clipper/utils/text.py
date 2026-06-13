"""Pure text/timing helpers: word-boundary snapping, filler trimming, ASS timing.

Kept dependency-free and side-effect-free so they are trivially unit-testable.
"""
from __future__ import annotations

import re
from typing import Iterable

from ..models import Word

# Conservative filler list. NOTE: we intentionally do NOT strip "amen",
# "hallelujah", "come on", etc. — in KBCF's call-and-response preaching those
# are meaningful content, not throat-clearing.
FILLER = {"um", "uh", "umm", "uhh", "uhm", "er", "erm", "ah", "mmm", "hmm"}

_NORM = re.compile(r"[^a-z']")


def _norm(tok: str) -> str:
    return _NORM.sub("", tok.lower())


def is_filler(tok: str) -> bool:
    return _norm(tok) in FILLER


def strip_leading_filler(words: list[Word]) -> list[Word]:
    """Drop leading filler tokens and a single immediate false-start repeat.

    "Um, um, the the kingdom..." -> "the kingdom...". We start where the
    thought starts, per the product spec's first-3-seconds rule.
    """
    out = list(words)
    while out and is_filler(out[0].text):
        out.pop(0)
    # collapse an immediate stuttered repeat of the first content word
    if len(out) >= 2 and _norm(out[0].text) and _norm(out[0].text) == _norm(out[1].text):
        out.pop(0)
    return out


def words_in_span(words: Iterable[Word], start: float, end: float) -> list[Word]:
    """Words whose center falls within [start, end] — robust to fuzzy edges."""
    picked = []
    for w in words:
        center = (w.start + w.end) / 2.0
        if start <= center <= end:
            picked.append(w)
    return picked


def snap_to_words(words: list[Word]) -> tuple[float, float]:
    """Snap a span to the first word's start and last word's end."""
    if not words:
        return 0.0, 0.0
    return round(words[0].start, 3), round(words[-1].end, 3)


def trim_to_max(words: list[Word], max_seconds: float) -> list[Word]:
    """Drop trailing words until the span fits within max_seconds."""
    out = list(words)
    while len(out) > 1 and (out[-1].end - out[0].start) > max_seconds:
        out.pop()
    return out


# --------------------------------------------------------------------------- #
# ASS subtitle helpers
# --------------------------------------------------------------------------- #


def fmt_ass_time(seconds: float) -> str:
    """Seconds -> H:MM:SS.cc (centiseconds), the ASS timestamp format."""
    seconds = max(0.0, seconds)
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    if cs == 100:  # rounding spill
        cs = 0
        s += 1
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def escape_ass(text: str) -> str:
    """Escape characters special to ASS dialogue/override blocks."""
    return text.replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}")


def chunk_words(words: list[Word], per_line: int = 3) -> list[list[Word]]:
    """Group words into caption events of up to `per_line` words (2-3 reads best)."""
    return [words[i : i + per_line] for i in range(0, len(words), per_line)]
