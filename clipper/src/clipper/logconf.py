"""Centralized logging. Uses rich if available, else plain stderr."""
from __future__ import annotations

import logging

_CONFIGURED = False


def setup(verbose: bool = False) -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return
    level = logging.DEBUG if verbose else logging.INFO
    try:
        from rich.logging import RichHandler

        handler: logging.Handler = RichHandler(
            rich_tracebacks=True, show_path=False, markup=True
        )
        fmt = "%(message)s"
    except Exception:  # pragma: no cover - rich is a dep but stay defensive
        handler = logging.StreamHandler()
        fmt = "%(asctime)s %(levelname)s %(name)s: %(message)s"
    logging.basicConfig(level=level, format=fmt, handlers=[handler])
    _CONFIGURED = True


def get(name: str) -> logging.Logger:
    return logging.getLogger(name)
