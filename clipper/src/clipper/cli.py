"""kbcf-clipper CLI (Typer).

Examples:
  kbcf-clipper run                       # BoxCast latest -> 4 clips
  kbcf-clipper run --file inbox/svc.mp4  # local source
  kbcf-clipper run --reframer face       # active-speaker crop
  kbcf-clipper run --from-transcript output/2026-06-07/transcript.json
  kbcf-clipper latest                    # show latest completed broadcast
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer

from . import logconf
from .config import Config
from .pipeline import RunOptions, run, run_from_transcript

app = typer.Typer(add_completion=False, help="Turn a KBCF sermon into 4 short-form clips.")


def _load(config: str) -> Config:
    return Config.load(config)


@app.command("run")
def run_cmd(
    config: str = typer.Option("config.yaml", "--config", "-c"),
    file: Optional[str] = typer.Option(None, "--file", help="Local source video."),
    broadcast: Optional[str] = typer.Option(None, "--broadcast", help="BoxCast broadcast URL/id."),
    facebook: Optional[str] = typer.Option(None, "--facebook", help="Facebook video URL (manual)."),
    from_transcript: Optional[str] = typer.Option(
        None, "--from-transcript", help="Skip ingest+ASR; start from a transcript.json."
    ),
    reframer: str = typer.Option("static", "--reframer", help="static | face"),
    asr_backend: str = typer.Option("whisperx", "--asr-backend", help="whisperx | faster-whisper"),
    mock_score: Optional[bool] = typer.Option(
        None, "--mock-score/--no-mock-score", help="Force heuristic vs Claude scoring."
    ),
    no_render: bool = typer.Option(False, "--no-render", help="Skip ffmpeg; captions+sidecars only."),
    refresh: bool = typer.Option(False, "--refresh", help="Ignore cached transcript/candidates."),
    verbose: bool = typer.Option(False, "--verbose", "-v"),
):
    """Run the full pipeline (the default command)."""
    logconf.setup(verbose)
    cfg = _load(config)
    opts = RunOptions(
        file=file,
        broadcast=broadcast,
        facebook=facebook,
        reframer=reframer,
        asr_backend=asr_backend,
        mock_score=mock_score,
        no_render=no_render,
        refresh=refresh,
    )
    out = (
        run_from_transcript(cfg, Path(from_transcript), opts)
        if from_transcript
        else run(cfg, opts)
    )
    typer.secho(f"\n✓ Output: {out}", fg=typer.colors.GREEN)


@app.command("latest")
def latest_cmd(
    config: str = typer.Option("config.yaml", "--config", "-c"),
    verbose: bool = typer.Option(False, "--verbose", "-v"),
):
    """Show the latest completed broadcast on the KBCF BoxCast channel."""
    logconf.setup(verbose)
    cfg = _load(config)
    from .stages.ingest import BoxCastClient

    b = BoxCastClient().latest_completed(
        cfg.source.boxcast_channel_id, name_filter=cfg.source.name_filter
    )
    typer.echo(f"{b.get('name')}  {b.get('starts_at')}  id={b['id']}")
    typer.echo(f"view: https://boxcast.tv/view/{b['id']}")


# Make `run` the default when invoked with no subcommand.
@app.callback(invoke_without_command=True)
def _default(ctx: typer.Context):
    if ctx.invoked_subcommand is None:
        typer.echo(ctx.get_help())


if __name__ == "__main__":
    app()
