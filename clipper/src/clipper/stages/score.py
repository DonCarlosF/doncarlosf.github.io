"""Stage 3 — Segment + score (Claude).

We window the transcript on thought boundaries and ask Claude (model from
config, key from ANTHROPIC_API_KEY) to return JSON-only candidate moments
scored on the 3 C's. Only the *text* transcript leaves the machine.

A deterministic heuristic scorer is included as an offline fallback (no API
key / no network). It is clearly logged and lets the full pipeline be
exercised and tested without spending tokens — it is NOT a substitute for
Claude's judgement in production.
"""
from __future__ import annotations

import json
import os
import re
from typing import Optional

from ..config import Config
from ..logconf import get
from ..models import MomentCandidate, MomentType, ThreeC, Transcript

log = get(__name__)

# 66 books for never-fabricate Scripture detection (compact, case-insensitive).
_BOOKS = (
    "Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 ?Samuel|2 ?Samuel|"
    "1 ?Kings|2 ?Kings|1 ?Chronicles|2 ?Chronicles|Ezra|Nehemiah|Esther|Job|Psalm[s]?|"
    "Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|"
    "Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|"
    "Matthew|Mark|Luke|John|Acts|Romans|1 ?Corinthians|2 ?Corinthians|Galatians|Ephesians|"
    "Philippians|Colossians|1 ?Thessalonians|2 ?Thessalonians|1 ?Timothy|2 ?Timothy|Titus|"
    "Philemon|Hebrews|James|1 ?Peter|2 ?Peter|1 ?John|2 ?John|3 ?John|Jude|Revelation"
)
SCRIPTURE_RE = re.compile(rf"\b({_BOOKS})\b\s*\d+(?::\d+(?:-\d+)?)?", re.IGNORECASE)

SYSTEM_PROMPT = """\
You are a short-form video editor for {church}, a contemporary Black-church \
congregation in Oakland. Their preaching is call-and-response with emotional \
peaks and congregation response — those moments often mark the strongest clips.

From the timestamped sermon transcript, pick SELF-CONTAINED moments that would \
stop a scroll: strong hooks, quotable one-liners, Scripture moments, emotional \
peaks, and clear application/CTA. One clip = one idea = one call to action.

For each moment, follow these rules strictly:
- TRIM to where the thought actually starts and ends. Cut intros, "last Sunday", \
  throat-clearing, and filler. The first 3 seconds must land immediately.
- Target {min_s}-{max_s} seconds.
- Write a scroll-stopping `hook_text` scored on the 3 C's (0-5 each):
    Cliffhanger (creates an open loop), Common (relatable to everyone), \
    Care (makes them feel something). Put the numeric scores in `scores`.
- Write a short `caption` (1-2 sentences) that ends EXACTLY with this CTA: "{cta}"
- Provide 3-6 `hashtags` (no '#', lowercase, relevant).
- `scripture_refs`: ONLY references actually spoken in the transcript. Never \
  invent or "correct" a reference. Empty list if none.
- `moment_type`: one of hook|quote|scripture|emotional|cta.
- `virality_score`: 0-100, your overall confidence this clip performs.
- `rationale`: one sentence on why this moment works.

Return ONLY a JSON array of objects with EXACTLY these keys:
[{{"start":0.0,"end":0.0,"hook_text":"","caption":"","hashtags":[],\
"scripture_refs":[],"moment_type":"hook","scores":{{"cliffhanger":0,"common":0,\
"care":0}},"virality_score":0,"rationale":""}}]
No prose, no markdown fences — JSON only."""


def _transcript_lines(transcript: Transcript) -> str:
    return "\n".join(f"[{s.start:.1f}-{s.end:.1f}] {s.text}" for s in transcript.segments)


def _window(transcript: Transcript, window_s: float, overlap_s: float):
    """Yield sub-transcripts so long sermons stay within context budget."""
    if not transcript.segments:
        return
    total_end = transcript.segments[-1].end
    start = 0.0
    while start < total_end:
        end = start + window_s
        segs = [s for s in transcript.segments if s.start >= start and s.start < end]
        if segs:
            yield Transcript(language=transcript.language, segments=segs)
        start += window_s - overlap_s


def _extract_json_array(text: str) -> list[dict]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
    start, end = text.find("["), text.rfind("]")
    if start == -1 or end == -1:
        raise ValueError("No JSON array found in model response")
    return json.loads(text[start : end + 1])


def _validate(items: list[dict], cfg: Config) -> list[MomentCandidate]:
    out: list[MomentCandidate] = []
    for item in items:
        try:
            cand = MomentCandidate.model_validate(item)
        except Exception as exc:
            log.warning("Dropping malformed candidate: %s", exc)
            continue
        # Enforce CTA on the caption regardless of model compliance.
        if cand.caption and not cand.caption.rstrip().endswith(cfg.church.cta):
            cand.caption = cand.caption.rstrip().rstrip(".") + ". " + cfg.church.cta
        out.append(cand)
    return out


# --------------------------------------------------------------------------- #
# Claude scorer
# --------------------------------------------------------------------------- #


def _claude_score(cfg: Config, transcript: Transcript) -> list[MomentCandidate]:
    from anthropic import Anthropic

    client = Anthropic()  # reads ANTHROPIC_API_KEY
    system = SYSTEM_PROMPT.format(
        church=cfg.church.name,
        min_s=cfg.clips.min_seconds,
        max_s=cfg.clips.max_seconds,
        cta=cfg.church.cta,
    )
    all_items: list[dict] = []
    windows = list(_window(transcript, window_s=600, overlap_s=60)) or [transcript]
    for i, win in enumerate(windows, 1):
        log.info("Scoring window %d/%d with %s", i, len(windows), cfg.api.model)
        msg = client.messages.create(
            model=cfg.api.model,
            max_tokens=4000,
            system=system,
            messages=[{"role": "user", "content": _transcript_lines(win)}],
        )
        text = "".join(block.text for block in msg.content if block.type == "text")
        try:
            all_items.extend(_extract_json_array(text))
        except ValueError as exc:
            log.warning("Window %d returned no parseable JSON: %s", i, exc)
    return _validate(all_items, cfg)


# --------------------------------------------------------------------------- #
# Heuristic (offline) scorer
# --------------------------------------------------------------------------- #

_EMOTION = re.compile(
    r"\b(glory|hallelujah|amen|grace|love|fear|broken|heal|cried?|joy|hope|faith|"
    r"victory|freedom|chains|breakthrough|miracle)\b",
    re.IGNORECASE,
)
_SECOND_PERSON = re.compile(r"\b(you|your|we|us|our)\b", re.IGNORECASE)
_LEADING_FILLER = re.compile(r"^(?:\s*(?:um|uh|umm|uhh|so|well|okay|alright|now|and)\b[,\s]*)+", re.IGNORECASE)
_SENTENCE_END = re.compile(r"[.?!]")


def _first_sentence(text: str, max_chars: int = 90) -> str:
    """Clean hook: drop leading filler, keep the first sentence, clamp length."""
    t = _LEADING_FILLER.sub("", text).strip()
    m = _SENTENCE_END.search(t)
    if m:
        t = t[: m.end()].strip()
    if len(t) > max_chars:
        t = t[:max_chars].rsplit(" ", 1)[0].rstrip(",;:") + "…"
    return t[:1].upper() + t[1:] if t else t


def _make_caption(hook: str, cta: str) -> str:
    body = hook.rstrip(" ,.;:!?")
    return f"{body}. {cta}"


def _heuristic_score(cfg: Config, transcript: Transcript) -> list[MomentCandidate]:
    log.warning("Using HEURISTIC scorer (no Claude). Set ANTHROPIC_API_KEY for real scoring.")
    cands: list[MomentCandidate] = []
    target = (cfg.clips.min_seconds + cfg.clips.max_seconds) / 2
    segs = transcript.segments
    i = 0
    while i < len(segs):
        start = segs[i].start
        j = i
        text_parts: list[str] = []
        while j < len(segs) and (segs[j].end - start) < target:
            text_parts.append(segs[j].text)
            j += 1
        if j < len(segs):
            text_parts.append(segs[j].text)
        end = segs[min(j, len(segs) - 1)].end
        text = " ".join(text_parts).strip()
        if not text or (end - start) < cfg.clips.min_seconds:
            i = j + 1
            continue

        scripture = list({m.group(0).strip() for m in SCRIPTURE_RE.finditer(text)})
        cliff = 5 if "?" in text else (3 if "!" in text else 2)
        common = min(5, 2 + len(_SECOND_PERSON.findall(text)) // 3)
        care = min(5, 1 + len(_EMOTION.findall(text)))
        if scripture:
            mtype = MomentType.scripture
        elif care >= 4:
            mtype = MomentType.emotional
        elif "?" in text:
            mtype = MomentType.hook
        else:
            mtype = MomentType.quote
        hook = _first_sentence(text)
        caption = _make_caption(hook, cfg.church.cta)
        virality = min(100.0, (cliff + common + care) / 15 * 80 + (10 if scripture else 0))
        cands.append(
            MomentCandidate(
                start=start,
                end=min(end, start + cfg.clips.max_seconds),
                hook_text=hook,
                caption=caption,
                hashtags=["kbcf", "oakland", "sermonclip", "faith", mtype.value],
                scripture_refs=scripture,
                moment_type=mtype,
                scores=ThreeC(cliffhanger=cliff, common=common, care=care),
                virality_score=round(virality, 1),
                rationale="Heuristic pick: emotional/scriptural density and direct address.",
            )
        )
        i = j + 1
    return cands


def score_transcript(
    cfg: Config, transcript: Transcript, *, mock: Optional[bool] = None
) -> list[MomentCandidate]:
    """Score candidate moments. Uses Claude unless mock=True or no API key."""
    if mock is None:
        mock = not os.environ.get("ANTHROPIC_API_KEY")
    cands = _heuristic_score(cfg, transcript) if mock else _claude_score(cfg, transcript)
    log.info("Scored %d candidate moment(s).", len(cands))
    return cands
