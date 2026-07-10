"""Stage 6 — Captions (ASS, karaoke-style).

Most viewers watch on mute, so captions are mandatory. From word-level
timestamps we build 2-3-word caption lines where the active word is painted
in the brand emphasis color, positioned inside the 9:16 safe zone (clear of
platform UI). The branding stage contributes hook/re-emphasis events into the
SAME ASS so ffmpeg burns everything in one pass.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from ..models import Word
from ..utils import text as T
from ..utils.colors import hex_to_ass

# Safe-zone geometry for a 1080x1920 canvas.
PLAY_W, PLAY_H = 1080, 1920
SAFE_MARGIN_H = 120     # keep text off the left/right edges
CAPTION_MARGIN_V = 470  # lift captions above bottom platform UI
HOOK_MARGIN_V = 1180    # hook banner sits in the upper third


@dataclass
class AssStyle:
    name: str
    fontname: str = "Montserrat"
    fontsize: int = 72
    primary: str = "&H00FFFFFF"   # white (ASS &HAABBGGRR)
    outline_colour: str = "&H00000000"
    bold: int = -1
    outline: float = 4.0
    shadow: float = 2.0
    alignment: int = 2            # 2 = bottom-center, 8 = top-center
    margin_v: int = CAPTION_MARGIN_V
    margin_l: int = SAFE_MARGIN_H
    margin_r: int = SAFE_MARGIN_H

    def to_line(self) -> str:
        # Format: V4+ Style fields in standard order.
        return (
            f"Style: {self.name},{self.fontname},{self.fontsize},{self.primary},"
            f"&H000000FF,{self.outline_colour},&H64000000,{self.bold},0,0,0,100,100,0,0,"
            f"1,{self.outline},{self.shadow},{self.alignment},"
            f"{self.margin_l},{self.margin_r},{self.margin_v},1"
        )


@dataclass
class AssEvent:
    start: float
    end: float
    text: str
    style: str = "Caption"


def caption_style(font: str) -> AssStyle:
    name, bold = font, -1
    if font.lower().endswith("-bold"):
        name, bold = font[:-5], -1
    return AssStyle(name="Caption", fontname=name, bold=bold)


def hook_style(font: str, emphasis_ass: str) -> AssStyle:
    name = font[:-5] if font.lower().endswith("-bold") else font
    return AssStyle(
        name="Hook",
        fontname=name,
        fontsize=64,
        primary=emphasis_ass,
        alignment=8,
        margin_v=HOOK_MARGIN_V,
        outline=5.0,
    )


def build_caption_events(
    words: list[Word], clip_start: float, emphasis_hex: str, per_line: int = 3
) -> list[AssEvent]:
    """One event per word: the word's 2-3-word line with the active word emphasized."""
    emphasis = hex_to_ass(emphasis_hex)
    white = "&H00FFFFFF"
    rel = [
        Word(text=w.text, start=w.start - clip_start, end=w.end - clip_start, speaker=w.speaker)
        for w in words
        if w.end > clip_start
    ]
    events: list[AssEvent] = []
    flat_index = 0
    lines = T.chunk_words(rel, per_line)
    for line in lines:
        for j, w in enumerate(line):
            nxt = rel[flat_index + 1] if flat_index + 1 < len(rel) else None
            ev_end = nxt.start if nxt else w.end
            rendered = " ".join(
                (f"{{\\c{emphasis}}}{T.escape_ass(lw.text)}{{\\c{white}}}" if k == j else T.escape_ass(lw.text))
                for k, lw in enumerate(line)
            )
            events.append(AssEvent(start=max(0.0, w.start), end=max(w.end, ev_end), text=rendered))
            flat_index += 1
    return events


def render_ass(path: Path, styles: list[AssStyle], events: list[AssEvent]) -> Path:
    """Write a complete ASS file (1080x1920 canvas)."""
    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {PLAY_W}",
        f"PlayResY: {PLAY_H}",
        "WrapStyle: 2",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,"
        "BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,"
        "BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
    ]
    lines += [s.to_line() for s in styles]
    lines += ["", "[Events]", "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text"]
    for ev in sorted(events, key=lambda e: e.start):
        lines.append(
            f"Dialogue: 0,{T.fmt_ass_time(ev.start)},{T.fmt_ass_time(ev.end)},"
            f"{ev.style},,0,0,0,,{ev.text}"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path
