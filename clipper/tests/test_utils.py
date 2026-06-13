from clipper.models import Word
from clipper.utils import text as T
from clipper.utils.colors import derive_brand_colors, hex_to_ass


def _w(txt, s, e):
    return Word(text=txt, start=s, end=e)


def test_strip_leading_filler():
    words = [_w("Um", 0, 0.3), _w("the", 0.4, 0.6), _w("the", 0.7, 0.9), _w("kingdom", 1.0, 1.4)]
    out = T.strip_leading_filler(words)
    assert [w.text for w in out] == ["the", "kingdom"]


def test_words_in_span_and_snap():
    words = [_w("a", 0, 1), _w("b", 1, 2), _w("c", 2, 3)]
    # center-based membership: a@0.5, b@1.5, c@2.5
    span = T.words_in_span(words, 0.4, 2.6)
    assert [w.text for w in span] == ["a", "b", "c"]
    assert T.snap_to_words(span) == (0.0, 3.0)
    assert [w.text for w in T.words_in_span(words, 0.4, 2.4)] == ["a", "b"]


def test_trim_to_max():
    words = [_w(str(i), i, i + 1) for i in range(10)]
    out = T.trim_to_max(words, 4.0)
    assert (out[-1].end - out[0].start) <= 4.0


def test_fmt_ass_time():
    assert T.fmt_ass_time(0) == "0:00:00.00"
    assert T.fmt_ass_time(61.5) == "0:01:01.50"
    assert T.fmt_ass_time(3661.234).startswith("1:01:01")


def test_escape_ass():
    assert T.escape_ass("a{b}c") == "a\\{b\\}c"


def test_hex_to_ass():
    # #F2C14E -> &H00 BB GG RR
    assert hex_to_ass("#F2C14E") == "&H004EC1F2"
    assert hex_to_ass("#FFFFFF") == "&H00FFFFFF"


def test_derive_brand_colors_fallback(tmp_path):
    primary, emphasis = derive_brand_colors(None)
    assert primary.startswith("#") and emphasis.startswith("#")
    # overrides win
    p, e = derive_brand_colors(None, primary_override="#111111", emphasis_override="#222222")
    assert (p, e) == ("#111111", "#222222")
