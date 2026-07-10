"""Stage 2 — Transcribe.

WhisperX is the default backend: it gives word-level timestamps (via forced
alignment) plus optional speaker diarization, which we need for accurate
caption karaoke and word-boundary snapping. faster-whisper is a lighter
fallback (word timestamps, no diarization).

Heavy deps are imported lazily so the rest of the pipeline (and the test
suite) import cleanly on machines without a GPU / ASR stack.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from ..logconf import get
from ..models import Transcript, TranscriptSegment, Word

log = get(__name__)


class TranscribeError(RuntimeError):
    pass


def _pick_device() -> tuple[str, str]:
    """(device, compute_type). CUDA float16 if available, else CPU int8."""
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda", "float16"
    except Exception:
        pass
    return "cpu", "int8"


def _transcribe_whisperx(
    audio_path: Path, model_size: str, language: Optional[str], diarize: bool
) -> Transcript:
    import whisperx  # type: ignore

    device, compute_type = _pick_device()
    log.info("WhisperX on %s (%s), model=%s", device, compute_type, model_size)

    audio = whisperx.load_audio(str(audio_path))
    model = whisperx.load_model(model_size, device, compute_type=compute_type, language=language)
    result = model.transcribe(audio, batch_size=16)
    lang = result.get("language", language or "en")

    # Forced alignment -> word-level timestamps
    align_model, meta = whisperx.load_align_model(language_code=lang, device=device)
    result = whisperx.align(
        result["segments"], align_model, meta, audio, device, return_char_alignments=False
    )

    speakers_by_word = {}
    if diarize:
        token = os.environ.get("HF_TOKEN")
        if not token:
            log.warning("HF_TOKEN not set; skipping diarization.")
        else:
            try:
                diarizer = whisperx.DiarizationPipeline(use_auth_token=token, device=device)
                diar = diarizer(audio)
                result = whisperx.assign_word_speakers(diar, result)
            except Exception as exc:  # pragma: no cover - network/model dependent
                log.warning("Diarization failed (%s); continuing without speakers.", exc)

    segments: list[TranscriptSegment] = []
    for seg in result["segments"]:
        words = []
        for w in seg.get("words", []):
            if w.get("start") is None or w.get("end") is None:
                continue
            words.append(
                Word(
                    text=w["word"].strip(),
                    start=float(w["start"]),
                    end=float(w["end"]),
                    confidence=w.get("score"),
                    speaker=w.get("speaker"),
                )
            )
        if not words:
            continue
        segments.append(
            TranscriptSegment(
                start=words[0].start,
                end=words[-1].end,
                text=seg.get("text", "").strip(),
                speaker=seg.get("speaker"),
                words=words,
            )
        )
    return Transcript(language=lang, backend="whisperx", segments=segments)


def _transcribe_faster_whisper(
    audio_path: Path, model_size: str, language: Optional[str]
) -> Transcript:
    from faster_whisper import WhisperModel  # type: ignore

    device, compute_type = _pick_device()
    log.info("faster-whisper on %s (%s), model=%s", device, compute_type, model_size)
    model = WhisperModel(model_size, device=device, compute_type=compute_type)
    seg_iter, info = model.transcribe(
        str(audio_path), language=language, word_timestamps=True, vad_filter=True
    )
    segments: list[TranscriptSegment] = []
    for seg in seg_iter:
        words = [
            Word(text=w.word.strip(), start=float(w.start), end=float(w.end), confidence=w.probability)
            for w in (seg.words or [])
            if w.start is not None and w.end is not None
        ]
        if not words:
            continue
        segments.append(
            TranscriptSegment(
                start=words[0].start, end=words[-1].end, text=seg.text.strip(), words=words
            )
        )
    return Transcript(language=info.language, backend="faster-whisper", segments=segments)


def transcribe(
    audio_path: str | Path,
    *,
    backend: str = "whisperx",
    model_size: str = "large-v3",
    language: Optional[str] = "en",
    diarize: bool = True,
    cache_path: Optional[Path] = None,
) -> Transcript:
    """Transcribe an audio/video file to a normalized Transcript.

    If `cache_path` exists, it is loaded instead of re-running ASR (re-runs
    of later stages are cheap and deterministic).
    """
    audio_path = Path(audio_path)
    if cache_path and Path(cache_path).exists():
        log.info("Loading cached transcript: %s", cache_path)
        return Transcript.load(Path(cache_path))

    if backend == "whisperx":
        try:
            t = _transcribe_whisperx(audio_path, model_size, language, diarize)
        except ImportError:
            log.warning("whisperx not installed; falling back to faster-whisper.")
            t = _transcribe_faster_whisper(audio_path, model_size, language)
    elif backend == "faster-whisper":
        t = _transcribe_faster_whisper(audio_path, model_size, language)
    else:
        raise TranscribeError(f"Unknown ASR backend: {backend}")

    if t.low_confidence_ratio > 0.15:
        log.warning(
            "High low-confidence word ratio (%.0f%%) — flag clips for closer review.",
            t.low_confidence_ratio * 100,
        )
    if cache_path:
        t.save(Path(cache_path))
    return t
