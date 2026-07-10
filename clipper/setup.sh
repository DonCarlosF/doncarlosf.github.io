#!/usr/bin/env bash
#
# kbcf-clipper — macOS (Apple Silicon) bootstrap.
#
#   ./setup.sh          core deps + ffmpeg + font  (Claude scoring + --no-render)
#   ./setup.sh --full   also installs WhisperX / mediapipe for real ASR + render
#
# Idempotent: safe to re-run. Creates a .venv and installs the CLI editable.
set -euo pipefail

FULL=0
[[ "${1:-}" == "--full" ]] && FULL=1

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$here"

say()  { printf "\033[1;36m==>\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[!]\033[0m %s\n" "$*"; }
die()  { printf "\033[1;31m[x]\033[0m %s\n" "$*" >&2; exit 1; }

[[ "$(uname -s)" == "Darwin" ]] || warn "Not macOS — this script targets a Mac; continuing best-effort."

# 1) Homebrew ---------------------------------------------------------------
if ! command -v brew >/dev/null 2>&1; then
  die "Homebrew not found. Install it first:
  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"
then re-run ./setup.sh"
fi

# 2) System deps: ffmpeg + python 3.11 + caption font -----------------------
say "Installing system dependencies via Homebrew (ffmpeg, python@3.11)…"
brew list ffmpeg     >/dev/null 2>&1 || brew install ffmpeg
brew list python@3.11 >/dev/null 2>&1 || brew install python@3.11
say "Installing caption font (Montserrat)…"
brew install --cask font-montserrat >/dev/null 2>&1 || warn "Could not install font-montserrat (libass will fall back to a system sans)."

# 3) Pick a Python 3.11+ interpreter ----------------------------------------
PY="$(command -v python3.11 || true)"
if [[ -z "$PY" ]]; then
  PY="$(command -v python3 || true)"
  [[ -n "$PY" ]] || die "No python3 found."
fi
ver="$("$PY" -c 'import sys;print("%d.%d"%sys.version_info[:2])')"
say "Using Python $ver at $PY"

# 4) venv + pip -------------------------------------------------------------
if [[ ! -d .venv ]]; then
  say "Creating virtualenv .venv…"
  "$PY" -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
python -m pip install -U pip wheel >/dev/null

if [[ "$FULL" == "1" ]]; then
  say "Installing kbcf-clipper + heavy extras (WhisperX, mediapipe)… this is a large download."
  pip install -e ".[transcribe,reframe,dev]"
else
  say "Installing kbcf-clipper core (+ test deps)…"
  pip install -e ".[dev]"
  warn "Skipped ASR/face-track extras. For real MP4 render: ./setup.sh --full"
fi

# 5) .env -------------------------------------------------------------------
if [[ ! -f .env ]]; then
  cp .env.example .env
  say "Wrote .env (add your ANTHROPIC_API_KEY)."
fi

# 6) Report -----------------------------------------------------------------
say "Verifying environment…"
kbcf-clipper doctor || true

cat <<'NEXT'

Next steps:
  source .venv/bin/activate
  # add your key:           edit .env  ->  ANTHROPIC_API_KEY=sk-ant-...
  # drop the church logo:   assets/kbcf-logo.png   (optional)
  kbcf-clipper latest                          # show latest KBCF broadcast
  kbcf-clipper run                             # full pipeline -> output/<date>/index.html
  make demo                                    # offline end-to-end on the sample sermon
NEXT
