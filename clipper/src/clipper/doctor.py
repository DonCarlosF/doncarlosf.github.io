"""`kbcf-clipper doctor` — print an environment readiness report.

Summarizes what's installed and which run modes are possible:
  - full     : real render (ffmpeg + ASR installed)
  - api-only : Claude scoring works but render needs ffmpeg
  - offline  : heuristic scoring + --no-render only
"""
from __future__ import annotations

from .config import Config
from .utils.env import Check, collect_checks


def _required_ok(checks: list[Check]) -> bool:
    return all(c.ok for c in checks if c.required)


def _verdict(checks: list[Check]) -> str:
    by = {c.name: c for c in checks}
    has_ffmpeg = by["ffmpeg"].ok and by["ffprobe"].ok
    has_asr = by["optional: whisperx"].ok or by["optional: faster_whisper"].ok
    has_key = by["ANTHROPIC_API_KEY"].ok
    if has_ffmpeg and has_asr and has_key:
        return "full — real ASR + Claude scoring + MP4 render"
    if has_ffmpeg and has_asr:
        return "full (heuristic scoring) — set ANTHROPIC_API_KEY for Claude"
    if has_key:
        return "api-only — Claude works; install ffmpeg + whisperx to render MP4s"
    return "offline — use `run --from-transcript ... --mock-score --no-render`"


def run_doctor(config: str = "config.yaml") -> bool:
    try:
        cfg = Config.load(config)
        logo = cfg.logo_path
    except Exception:
        cfg, logo = None, None

    checks = collect_checks(logo_path=logo)
    try:
        from rich.console import Console
        from rich.table import Table

        console = Console()
        table = Table(title="kbcf-clipper — environment doctor", show_lines=False)
        table.add_column("check")
        table.add_column("status")
        table.add_column("detail", overflow="fold")
        for c in checks:
            mark = "[green]OK[/green]" if c.ok else ("[red]MISSING[/red]" if c.required else "[yellow]—[/yellow]")
            table.add_row(c.name, mark, c.detail)
        console.print(table)
        console.print(f"[bold]Ready for:[/bold] {_verdict(checks)}")
        if not _required_ok(checks):
            console.print("[red]Some required components are missing — see `setup.sh`.[/red]")
    except Exception:  # pragma: no cover - rich always present, stay defensive
        for c in checks:
            mark = "OK" if c.ok else ("MISSING" if c.required else "-")
            print(f"  [{mark:>7}] {c.name:<28} {c.detail}")
        print(f"Ready for: {_verdict(checks)}")

    return _required_ok(checks)
