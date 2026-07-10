"""End-to-end offline run: transcript -> score -> select -> captions ->
package, with no ffmpeg and the heuristic scorer."""
from pathlib import Path

from clipper.pipeline import RunOptions, run_from_transcript

FIXTURE = Path(__file__).resolve().parent.parent / "fixtures" / "sample_transcript.json"


def test_offline_pipeline_produces_review_queue(cfg, tmp_path, monkeypatch):
    # Redirect output under tmp_path by overriding the output template.
    cfg.output.dir = str(tmp_path / "{broadcast_date}")
    opts = RunOptions(mock_score=True, no_render=True, refresh=True)
    out = run_from_transcript(cfg, FIXTURE, opts)

    clips = sorted(out.glob("clip_*.json"))
    assert len(clips) == cfg.clips.count_per_sermon
    assert (out / "index.html").exists()
    assert (out / "manifest.json").exists()
    assert (out / "source.json").exists()
    # Each clip has an ASS caption file and a sidecar with a CTA caption.
    import json

    for c in clips:
        data = json.loads(c.read_text())
        assert data["files"]["captions"].endswith(".ass")
        assert (out / data["files"]["captions"]).exists()
        assert data["caption"].endswith(cfg.church.cta)
        assert cfg.clips.min_seconds <= data["source"]["duration"] <= cfg.clips.max_seconds + 0.01

    html = (out / "index.html").read_text()
    assert "Approve" in html and "Reject" in html
