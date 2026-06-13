"""Stage 1 — Ingest.

Resolve a source to a local high-res .mp4 and probe it. Resolution order
(when no explicit override is given):

  1. BoxCast: latest *completed* broadcast on the KBCF channel -> signed HLS
     playlist -> download with yt-dlp.
  2. inbox/: newest local media file dropped by a human (first-run / fallback).
  3. Facebook: only when an explicit --facebook URL is supplied (we never
     auto-scrape; FB blocks automation and the church owns its own video).

Overrides: --file <path> (skip everything) or --broadcast <url-or-id>.

The BoxCast REST endpoints below are the church's public read API, verified
against channel `wsiikymmlhksnkgmc24r`:
  GET /channels/{id}/broadcasts?q=timeframe:past&s=-starts_at   -> list
  GET /broadcasts/{id}/view                                     -> {playlist}
"""
from __future__ import annotations

import re
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import requests

from ..config import Config
from ..logconf import get
from ..models import IngestPath, SourceMeta
from ..utils import ffmpeg

log = get(__name__)

BOXCAST_REST = "https://rest.boxcast.com"
MEDIA_EXTS = {".mp4", ".mov", ".mkv", ".m4v", ".ts", ".webm"}


class IngestError(RuntimeError):
    pass


# --------------------------------------------------------------------------- #
# BoxCast REST client
# --------------------------------------------------------------------------- #


class BoxCastClient:
    def __init__(self, base: str = BOXCAST_REST, timeout: int = 20):
        self.base = base.rstrip("/")
        self.timeout = timeout
        self.s = requests.Session()
        self.s.headers["Accept"] = "application/json"

    def latest_completed(
        self, channel_id: str, name_filter: Optional[str] = None, limit: int = 25
    ) -> dict:
        """Most recent broadcast with timeframe=past (optionally name-filtered)."""
        url = f"{self.base}/channels/{channel_id}/broadcasts"
        params = {"l": limit, "s": "-starts_at", "q": "timeframe:past"}
        r = self.s.get(url, params=params, timeout=self.timeout)
        r.raise_for_status()
        broadcasts = r.json()
        if name_filter:
            nf = name_filter.lower()
            broadcasts = [b for b in broadcasts if nf in (b.get("name", "").lower())]
        if not broadcasts:
            raise IngestError(
                f"No completed broadcasts on channel {channel_id}"
                + (f" matching '{name_filter}'" if name_filter else "")
            )
        return broadcasts[0]

    def view(self, broadcast_id: str) -> dict:
        """View payload incl. the signed HLS `playlist` URL for a recording."""
        r = self.s.get(f"{self.base}/broadcasts/{broadcast_id}/view", timeout=self.timeout)
        r.raise_for_status()
        return r.json()


def _broadcast_date(broadcast: dict) -> str:
    ts = broadcast.get("starts_at")
    if ts:
        try:
            return datetime.fromisoformat(ts.replace("Z", "+00:00")).date().isoformat()
        except ValueError:
            pass
    return date.today().isoformat()


# --------------------------------------------------------------------------- #
# Download
# --------------------------------------------------------------------------- #


def _ytdlp_download(url: str, out_base: Path) -> Path:
    """Download a URL (HLS playlist or embed page) to mp4 via yt-dlp."""
    try:
        import yt_dlp
    except ImportError as exc:  # pragma: no cover
        raise IngestError("yt-dlp is required to download remote video.") from exc

    out_base.parent.mkdir(parents=True, exist_ok=True)
    opts = {
        "outtmpl": f"{out_base}.%(ext)s",
        "format": "bestvideo*+bestaudio/best",
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "concurrent_fragment_downloads": 4,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        ydl.download([url])
    # yt-dlp may emit .mp4/.mkv depending on merge; find the produced file
    for ext in (".mp4", ".mkv", ".webm", ".m4v"):
        cand = out_base.with_suffix(ext)
        if cand.exists():
            return cand
    matches = sorted(out_base.parent.glob(f"{out_base.name}.*"))
    if matches:
        return matches[0]
    raise IngestError(f"yt-dlp produced no output for {url}")


def _newest_inbox_file(inbox: Path) -> Optional[Path]:
    if not inbox.exists():
        return None
    media = [p for p in inbox.iterdir() if p.suffix.lower() in MEDIA_EXTS]
    if not media:
        return None
    return max(media, key=lambda p: p.stat().st_mtime)


def _parse_broadcast_id(value: str) -> str:
    """Accept a bare id or any boxcast URL containing one."""
    m = re.search(r"([a-z0-9]{20})", value)
    return m.group(1) if m else value


# --------------------------------------------------------------------------- #
# Public entrypoint
# --------------------------------------------------------------------------- #


def _finalize(meta: SourceMeta) -> SourceMeta:
    """Probe the local file and fill in technical metadata."""
    if ffmpeg.available():
        try:
            pr = ffmpeg.probe(meta.local_path)
            meta.duration, meta.width, meta.height, meta.fps = (
                pr.duration,
                pr.width,
                pr.height,
                pr.fps,
            )
        except Exception as exc:  # pragma: no cover - defensive
            log.warning("ffprobe failed: %s", exc)
    else:
        log.warning("ffprobe not available; skipping technical probe.")
    log.info(
        "Ingested via %s -> %s (%.0fs, %sx%s)",
        meta.ingest_path.value,
        meta.local_path,
        meta.duration or 0,
        meta.width,
        meta.height,
    )
    return meta


def ingest(
    cfg: Config,
    *,
    file: Optional[str] = None,
    broadcast: Optional[str] = None,
    facebook: Optional[str] = None,
    work_dir: Optional[Path] = None,
) -> SourceMeta:
    """Resolve the configured/overridden source to a local mp4 + metadata."""
    work_dir = work_dir or cfg.path("output/_ingest")
    work_dir.mkdir(parents=True, exist_ok=True)

    # 1) Explicit local file -------------------------------------------------
    if file:
        p = Path(file).resolve()
        if not p.exists():
            raise IngestError(f"--file not found: {p}")
        return _finalize(
            SourceMeta(
                ingest_path=IngestPath.file,
                local_path=p,
                title=p.stem,
                broadcast_date=date.fromtimestamp(p.stat().st_mtime).isoformat(),
            )
        )

    client = BoxCastClient()

    # 2) Explicit broadcast URL/id ------------------------------------------
    if broadcast:
        bid = _parse_broadcast_id(broadcast)
        log.info("Resolving explicit broadcast %s", bid)
        view = client.view(bid)
        playlist = view.get("playlist")
        if not playlist:
            raise IngestError(f"Broadcast {bid} has no playable recording yet.")
        out = _ytdlp_download(playlist, work_dir / bid)
        return _finalize(
            SourceMeta(
                ingest_path=IngestPath.boxcast,
                local_path=out,
                broadcast_id=bid,
                source_url=broadcast,
                broadcast_date=date.today().isoformat(),
            )
        )

    # 3) Explicit Facebook URL (manual, never auto-discovered) --------------
    if facebook:
        log.info("Resolving Facebook video via yt-dlp: %s", facebook)
        out = _ytdlp_download(facebook, work_dir / "facebook")
        return _finalize(
            SourceMeta(
                ingest_path=IngestPath.facebook,
                local_path=out,
                source_url=facebook,
                broadcast_date=date.today().isoformat(),
            )
        )

    # 4) Default: BoxCast latest completed, then inbox/ fallback ------------
    try:
        b = client.latest_completed(
            cfg.source.boxcast_channel_id, name_filter=cfg.source.name_filter
        )
        bid = b["id"]
        bdate = _broadcast_date(b)
        log.info("Latest completed broadcast: %s (%s) %s", b.get("name"), bdate, bid)
        view = client.view(bid)
        playlist = view.get("playlist")
        if not playlist:
            raise IngestError(f"Broadcast {bid} not yet recorded (status={view.get('status')}).")
        out = _ytdlp_download(playlist, work_dir / bid)
        return _finalize(
            SourceMeta(
                ingest_path=IngestPath.boxcast,
                local_path=out,
                broadcast_id=bid,
                title=b.get("name"),
                source_url=f"https://boxcast.tv/view/{bid}",
                broadcast_date=bdate,
            )
        )
    except Exception as exc:
        log.warning("BoxCast pull failed (%s); trying inbox/ fallback.", exc)

    inbox_file = _newest_inbox_file(cfg.path("inbox"))
    if inbox_file:
        log.info("Using inbox fallback: %s", inbox_file)
        return _finalize(
            SourceMeta(
                ingest_path=IngestPath.inbox,
                local_path=inbox_file,
                title=inbox_file.stem,
                broadcast_date=date.fromtimestamp(inbox_file.stat().st_mtime).isoformat(),
            )
        )

    raise IngestError(
        "Could not ingest: BoxCast pull failed and inbox/ is empty. "
        "Drop an MP4 in inbox/ or pass --file/--broadcast."
    )
