"""Thin, well-logged wrappers around the ffmpeg/ffprobe binaries.

We shell out via subprocess rather than ffmpeg-python: it keeps the exact
filtergraph visible/debuggable and avoids an extra abstraction layer over a
tool we already know well.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Sequence

from ..logconf import get

log = get(__name__)


class FfmpegMissing(RuntimeError):
    """Raised when ffmpeg/ffprobe are not on PATH."""


def _bin(name: str) -> str:
    found = shutil.which(name)
    if not found:
        raise FfmpegMissing(
            f"'{name}' not found on PATH. Install ffmpeg "
            "(macOS: `brew install ffmpeg`, Ubuntu: `apt-get install ffmpeg`)."
        )
    return found


def available() -> bool:
    return bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))


@dataclass
class ProbeResult:
    duration: Optional[float]
    width: Optional[int]
    height: Optional[int]
    fps: Optional[float]
    has_audio: bool


def _parse_fps(rate: str | None) -> Optional[float]:
    if not rate or rate in ("0/0", "0"):
        return None
    if "/" in rate:
        num, den = rate.split("/")
        den_f = float(den)
        return round(float(num) / den_f, 3) if den_f else None
    return float(rate)


def probe(path: str | Path) -> ProbeResult:
    """ffprobe a media file for the metadata the pipeline needs."""
    out = subprocess.run(
        [
            _bin("ffprobe"),
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    data = json.loads(out)
    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    has_audio = any(s.get("codec_type") == "audio" for s in streams)
    duration = None
    if "format" in data and data["format"].get("duration"):
        duration = float(data["format"]["duration"])
    width = height = fps = None
    if video:
        width = video.get("width")
        height = video.get("height")
        fps = _parse_fps(video.get("avg_frame_rate") or video.get("r_frame_rate"))
        if duration is None and video.get("duration"):
            duration = float(video["duration"])
    return ProbeResult(duration, width, height, fps, has_audio)


def run(args: Sequence[str], *, desc: str = "ffmpeg") -> None:
    """Run an ffmpeg command, surfacing stderr on failure."""
    cmd = [_bin("ffmpeg"), "-hide_banner", "-loglevel", "error", "-y", *args]
    log.debug("[%s] %s", desc, " ".join(cmd))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"{desc} failed (exit {proc.returncode}):\n{proc.stderr.strip()}")
