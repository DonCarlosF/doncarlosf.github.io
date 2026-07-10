from clipper.models import Clip, MomentCandidate, ThreeC, Transcript


def test_config_seed_values(cfg):
    assert cfg.church.short_name == "KBCF"
    assert cfg.source.boxcast_channel_id == "wsiikymmlhksnkgmc24r"
    assert cfg.clips.count_per_sermon == 4
    assert cfg.clips.min_seconds == 30 and cfg.clips.max_seconds == 90
    assert cfg.clips.aspect_ratios == ["9:16"]
    assert cfg.api.model == "claude-sonnet-4-6"


def test_output_dir_templating(cfg):
    out = cfg.output_dir("2026-06-07")
    assert out.name == "2026-06-07"
    assert out.is_absolute()


def test_threec_total():
    assert ThreeC(cliffhanger=5, common=4, care=3).total == 12


def test_clip_sidecar_roundtrip(tmp_path):
    cand = MomentCandidate(
        start=10.0,
        end=55.0,
        hook_text="Watch this",
        caption="Watch this. CTA",
        hashtags=["kbcf"],
        scripture_refs=["Mark 4"],
        moment_type="scripture",
        scores=ThreeC(cliffhanger=4, common=3, care=4),
        virality_score=80,
        rationale="strong",
    )
    clip = Clip(**cand.model_dump(), index=1)
    p = tmp_path / "clip_01.json"
    clip.write_sidecar(p)
    data = clip.sidecar()
    assert data["scores"]["total_3c"] == 11
    assert data["source"]["duration"] == 45.0
    assert p.exists()


def test_transcript_low_confidence_ratio(transcript):
    assert transcript.low_confidence_ratio == 0.0
    transcript.segments[0].words[0].confidence = 0.1
    assert transcript.low_confidence_ratio > 0.0


def test_transcript_save_load(tmp_path, transcript):
    p = tmp_path / "t.json"
    transcript.save(p)
    again = Transcript.load(p)
    assert len(again.segments) == len(transcript.segments)
    assert again.words[0].text == transcript.words[0].text
