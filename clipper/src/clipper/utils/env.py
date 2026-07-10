"""Minimal .env loader + environment capability checks.

No python-dotenv dependency: we parse a simple KEY=VALUE file ourselves and
only set vars that aren't already in the environment (real env wins).
"""
from __future__ import annotations

import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


def load_dotenv(path: Path) -> bool:
    """Load KEY=VALUE pairs from `path` into os.environ (without overriding)."""
    p = Path(path)
    if not p.exists():
        return False
    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val
    return True


@dataclass
class Check:
    name: str
    ok: bool
    detail: str = ""
    required: bool = True


def _imports(mod: str) -> tuple[bool, str]:
    try:
        m = __import__(mod)
        ver = getattr(m, "__version__", "") or getattr(m, "VERSION", "")
        return True, str(ver)
    except Exception as exc:  # pragma: no cover - import-error dependent
        return False, type(exc).__name__


def torch_device() -> str:
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps (note: WhisperX/CTranslate2 run on CPU on macOS)"
        return "cpu"
    except Exception:
        return "torch not installed"


def collect_checks(logo_path: Optional[Path] = None) -> list[Check]:
    import sys

    checks: list[Check] = []

    # Python
    v = sys.version_info
    checks.append(
        Check("python>=3.11", v >= (3, 11), f"{v.major}.{v.minor}.{v.micro}")
    )

    # System binaries
    for b in ("ffmpeg", "ffprobe"):
        found = shutil.which(b)
        checks.append(Check(b, bool(found), found or "not on PATH"))

    # Core libs
    for mod in ("pydantic", "typer", "yaml", "jinja2", "requests", "anthropic", "yt_dlp", "PIL"):
        ok, detail = _imports(mod)
        checks.append(Check(f"core: {mod}", ok, detail))

    # Optional heavy libs
    for mod in ("whisperx", "faster_whisper", "mediapipe", "cv2", "torch"):
        ok, detail = _imports(mod)
        checks.append(Check(f"optional: {mod}", ok, detail, required=False))
    checks.append(Check("compute device", True, torch_device(), required=False))

    # Secrets
    checks.append(
        Check("ANTHROPIC_API_KEY", bool(os.environ.get("ANTHROPIC_API_KEY")),
              "set" if os.environ.get("ANTHROPIC_API_KEY") else "unset (uses heuristic scorer)",
              required=False)
    )
    checks.append(
        Check("HF_TOKEN (diarization)", bool(os.environ.get("HF_TOKEN")),
              "set" if os.environ.get("HF_TOKEN") else "unset (skips speaker labels)",
              required=False)
    )

    # Branding
    if logo_path is not None:
        present = Path(logo_path).exists()
        checks.append(
            Check("logo image", present,
                  str(logo_path) if present else f"missing -> KBCF text wordmark",
                  required=False)
        )
    return checks
