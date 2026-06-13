"""Stage 4 — Select + tighten.

Rank candidates by virality, then for each: snap to word boundaries, strip
leading filler/false starts, enforce min/max duration (extending short picks
into the following words), drop overlapping picks, and refill from the
next-best so we still deliver exactly `count_per_sermon` distinct clips.
"""
from __future__ import annotations

from ..config import Config
from ..logconf import get
from ..models import Clip, MomentCandidate, Transcript, Word
from ..utils import text as T

log = get(__name__)


def _overlaps(a: tuple[float, float], spans: list[tuple[float, float]], pad: float = 0.5) -> bool:
    for s, e in spans:
        if a[0] < e + pad and s - pad < a[1]:
            return True
    return False


def _low_conf(words: list[Word]) -> bool:
    scored = [w for w in words if w.confidence is not None]
    if not scored:
        return False
    shaky = sum(1 for w in scored if w.confidence is not None and w.confidence < 0.5)
    return (shaky / len(scored)) > 0.2


def _tighten(
    cand: MomentCandidate, all_words: list[Word], cfg: Config
) -> tuple[float, float, bool] | None:
    """Return (start, end, low_confidence) snapped/trimmed/extended, or None."""
    span = T.words_in_span(all_words, cand.start, cand.end)
    span = T.strip_leading_filler(span)
    if not span:
        return None

    # Extend a too-short pick using the words that follow it in the transcript.
    last_idx = all_words.index(span[-1])
    while (span[-1].end - span[0].start) < cfg.clips.min_seconds and last_idx + 1 < len(all_words):
        last_idx += 1
        span.append(all_words[last_idx])

    # Trim a too-long pick at a word boundary.
    span = T.trim_to_max(span, cfg.clips.max_seconds)

    start, end = T.snap_to_words(span)
    duration = end - start
    if duration < cfg.clips.min_seconds:
        log.debug("Skipping candidate @%.1fs: only %.1fs after tightening", cand.start, duration)
        return None
    return start, end, _low_conf(span)


def select(
    cfg: Config, candidates: list[MomentCandidate], transcript: Transcript
) -> list[Clip]:
    all_words = transcript.words
    ranked = sorted(
        candidates, key=lambda c: (c.virality_score, c.scores.total), reverse=True
    )
    cleared = sum(1 for c in ranked if c.scores.total >= cfg.clips.score_threshold)
    log.info(
        "%d/%d candidates clear the %d/15 threshold; selecting top %d.",
        cleared,
        len(ranked),
        cfg.clips.score_threshold,
        cfg.clips.count_per_sermon,
    )

    chosen: list[Clip] = []
    spans: list[tuple[float, float]] = []
    for cand in ranked:
        if len(chosen) >= cfg.clips.count_per_sermon:
            break
        tightened = _tighten(cand, all_words, cfg) if all_words else (cand.start, cand.end, False)
        if not tightened:
            continue
        start, end, low_conf = tightened
        if _overlaps((start, end), spans):
            log.debug("Skipping overlapping pick @%.1f-%.1f", start, end)
            continue
        spans.append((start, end))
        clip = Clip(
            **cand.model_dump(),
            index=len(chosen) + 1,
            aspect_ratio=cfg.clips.aspect_ratios[0],
            low_confidence=low_conf,
        )
        clip.start, clip.end = start, end
        chosen.append(clip)

    if len(chosen) < cfg.clips.count_per_sermon:
        log.warning(
            "Only %d distinct clips available (wanted %d).",
            len(chosen),
            cfg.clips.count_per_sermon,
        )
    return chosen
