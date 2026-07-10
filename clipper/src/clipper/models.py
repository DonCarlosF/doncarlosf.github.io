"""Typed schema for everything that flows through the pipeline.

We use pydantic v2 so the Claude JSON contract, the transcript, and the
clip sidecars are all validated at the boundary instead of trusting dicts.
"""
from __future__ import annotations

import json
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field, computed_field, field_validator

# --------------------------------------------------------------------------- #
# Transcript (output of Stage 2)
# --------------------------------------------------------------------------- #


class Word(BaseModel):
    """A single transcribed word with timing. Times are seconds from clip start."""

    text: str
    start: float
    end: float
    # WhisperX alignment confidence in [0,1]; used to flag shaky transcription.
    confidence: Optional[float] = None
    speaker: Optional[str] = None


class TranscriptSegment(BaseModel):
    """A sentence/utterance-level chunk, the unit Claude scores over."""

    start: float
    end: float
    text: str
    speaker: Optional[str] = None
    words: list[Word] = Field(default_factory=list)


class Transcript(BaseModel):
    """Normalized transcript: per-word timings + speaker labels + provenance."""

    language: str = "en"
    backend: str = "whisperx"
    segments: list[TranscriptSegment] = Field(default_factory=list)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def words(self) -> list[Word]:
        """Flattened word stream across all segments (word-boundary snapping)."""
        out: list[Word] = []
        for seg in self.segments:
            out.extend(seg.words)
        return out

    @computed_field  # type: ignore[prop-decorator]
    @property
    def low_confidence_ratio(self) -> float:
        """Fraction of words below 0.5 confidence — surfaced as a quality flag."""
        scored = [w for w in self.words if w.confidence is not None]
        if not scored:
            return 0.0
        shaky = sum(1 for w in scored if w.confidence is not None and w.confidence < 0.5)
        return round(shaky / len(scored), 4)

    def save(self, path: Path) -> None:
        path.write_text(self.model_dump_json(indent=2), encoding="utf-8")

    @classmethod
    def load(cls, path: Path) -> "Transcript":
        return cls.model_validate_json(Path(path).read_text(encoding="utf-8"))


# --------------------------------------------------------------------------- #
# Source metadata (output of Stage 1)
# --------------------------------------------------------------------------- #


class IngestPath(str, Enum):
    boxcast = "boxcast"
    facebook = "facebook"
    inbox = "inbox"
    file = "file"


class SourceMeta(BaseModel):
    """Everything we know about the ingested VOD."""

    ingest_path: IngestPath
    local_path: Path
    broadcast_id: Optional[str] = None
    title: Optional[str] = None
    source_url: Optional[str] = None
    broadcast_date: str  # YYYY-MM-DD, used in output dir
    duration: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    fps: Optional[float] = None

    def save(self, path: Path) -> None:
        path.write_text(self.model_dump_json(indent=2), encoding="utf-8")


# --------------------------------------------------------------------------- #
# Scoring (Claude output, Stage 3) and final clips (Stage 4+)
# --------------------------------------------------------------------------- #


class MomentType(str, Enum):
    hook = "hook"
    quote = "quote"
    scripture = "scripture"
    emotional = "emotional"
    cta = "cta"


class ThreeC(BaseModel):
    """The 3 C's hook score, 0-5 each, 15 total."""

    cliffhanger: int = Field(ge=0, le=5)
    common: int = Field(ge=0, le=5)
    care: int = Field(ge=0, le=5)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def total(self) -> int:
        return self.cliffhanger + self.common + self.care


class MomentCandidate(BaseModel):
    """Exactly the JSON contract we ask Claude to return, validated.

    `start`/`end` are source-VOD seconds. They get snapped to word boundaries
    and tightened in Stage 4 before becoming a Clip.
    """

    start: float
    end: float
    hook_text: str = ""
    caption: str = ""
    hashtags: list[str] = Field(default_factory=list)
    scripture_refs: list[str] = Field(default_factory=list)
    moment_type: MomentType = MomentType.quote
    scores: ThreeC
    virality_score: float = Field(ge=0, le=100)
    rationale: str = ""

    @field_validator("start", "end")
    @classmethod
    def _non_negative(cls, v: float) -> float:
        return max(0.0, float(v))

    @property
    def duration(self) -> float:
        return round(self.end - self.start, 3)


class Clip(MomentCandidate):
    """A finalized, selected clip: candidate + ordering + output artifacts."""

    index: int = 0  # 1..N rank order
    aspect_ratio: str = "9:16"
    low_confidence: bool = False  # transcription quality flag for this span
    # Output artifact paths (filled in by render/package stages), relative to clip dir.
    video_file: Optional[str] = None
    thumbnail_file: Optional[str] = None
    captions_file: Optional[str] = None

    def sidecar(self) -> dict:
        """The clip.json review sidecar — human-facing, stable field order."""
        return {
            "index": self.index,
            "hook_text": self.hook_text,
            "caption": self.caption,
            "hashtags": self.hashtags,
            "scripture_refs": self.scripture_refs,
            "moment_type": self.moment_type.value,
            "scores": {
                "cliffhanger": self.scores.cliffhanger,
                "common": self.scores.common,
                "care": self.scores.care,
                "total_3c": self.scores.total,
            },
            "virality_score": self.virality_score,
            "rationale": self.rationale,
            "source": {
                "start": round(self.start, 3),
                "end": round(self.end, 3),
                "duration": self.duration,
            },
            "aspect_ratio": self.aspect_ratio,
            "low_confidence_transcription": self.low_confidence,
            "files": {
                "video": self.video_file,
                "thumbnail": self.thumbnail_file,
                "captions": self.captions_file,
            },
            "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        }

    def write_sidecar(self, path: Path) -> None:
        path.write_text(json.dumps(self.sidecar(), indent=2), encoding="utf-8")
