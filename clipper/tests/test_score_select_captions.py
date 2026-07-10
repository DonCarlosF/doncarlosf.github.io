from clipper.stages import captions as cap
from clipper.stages.score import SCRIPTURE_RE, _first_sentence, score_transcript
from clipper.stages.select import select


def test_scripture_regex():
    found = [m.group(0) for m in SCRIPTURE_RE.finditer("Turn to Mark 4 and also John 3:16 today")]
    assert any("Mark 4" in f for f in found)
    assert any("John 3:16" in f for f in found)


def test_first_sentence_strips_filler_and_clamps():
    out = _first_sentence("Um, so, can I talk to somebody who is hurting today? And then more.")
    assert not out.lower().startswith("um")
    assert out.endswith("?")


def test_heuristic_caption_ends_with_cta(cfg, transcript):
    cands = score_transcript(cfg, transcript, mock=True)
    assert cands, "heuristic should produce candidates"
    for c in cands:
        assert c.caption.endswith(cfg.church.cta)
        assert 0 <= c.scores.total <= 15


def test_select_respects_count_duration_and_overlap(cfg, transcript):
    cands = score_transcript(cfg, transcript, mock=True)
    clips = select(cfg, cands, transcript)
    assert len(clips) <= cfg.clips.count_per_sermon
    spans = []
    for clip in clips:
        assert cfg.clips.min_seconds <= clip.duration <= cfg.clips.max_seconds + 0.01
        for s, e in spans:
            assert not (clip.start < e and s < clip.end), "clips must not overlap"
        spans.append((clip.start, clip.end))
        assert clip.index >= 1


def test_caption_events_active_word_emphasis():
    from clipper.models import Word

    words = [Word(text=w, start=i * 0.5, end=i * 0.5 + 0.4) for i, w in enumerate("a b c d".split())]
    events = cap.build_caption_events(words, clip_start=0.0, emphasis_hex="#F2C14E")
    assert len(events) == 4  # one event per word
    assert "&H004EC1F2" in events[0].text  # emphasis color override present


def test_render_ass_writes_valid_file(tmp_path):
    from clipper.models import Word

    words = [Word(text=w, start=i * 0.5, end=i * 0.5 + 0.4) for i, w in enumerate("peace be still".split())]
    events = cap.build_caption_events(words, 0.0, "#F2C14E")
    styles = [cap.caption_style("Montserrat-Bold")]
    p = cap.render_ass(tmp_path / "c.ass", styles, events)
    body = p.read_text()
    assert "[V4+ Styles]" in body and "[Events]" in body
    assert "Dialogue:" in body
