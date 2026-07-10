import pytest

from clipper.stages.ingest import BoxCastClient, _broadcast_date, _parse_broadcast_id
from clipper.stages.reframe import StaticCenterReframer, compute_crop_dims, get_reframer


def test_parse_broadcast_id():
    assert _parse_broadcast_id("https://boxcast.tv/view/abcdefghij0123456789") == "abcdefghij0123456789"
    assert _parse_broadcast_id("abcdefghij0123456789") == "abcdefghij0123456789"


def test_broadcast_date():
    assert _broadcast_date({"starts_at": "2026-06-07T15:57:00Z"}) == "2026-06-07"
    assert _broadcast_date({}) != ""  # falls back to today


def test_latest_completed_name_filter(monkeypatch):
    sample = [
        {"id": "a" * 20, "name": "Bible Study", "starts_at": "2026-06-11T01:00:00Z"},
        {"id": "b" * 20, "name": "Kingdom Builders Sunday Service", "starts_at": "2026-06-07T15:00:00Z"},
    ]

    class FakeResp:
        def raise_for_status(self):
            pass

        def json(self):
            return sample

    client = BoxCastClient()
    monkeypatch.setattr(client.s, "get", lambda *a, **k: FakeResp())
    # No filter -> newest overall (the Bible Study)
    assert client.latest_completed("cid")["id"] == "a" * 20
    # Filter -> the Sunday service
    assert client.latest_completed("cid", name_filter="Sunday Service")["id"] == "b" * 20


def test_compute_crop_dims_landscape():
    cw, ch = compute_crop_dims(1920, 1080, 9 / 16)
    assert ch == 1080
    assert cw == pytest.approx(607, abs=2)
    assert cw % 2 == 0 and ch % 2 == 0


def test_static_reframer_crop_filter():
    plan = StaticCenterReframer().plan("v.mp4", 0, 30, 1920, 1080, "9:16")
    f = plan.crop_filter()
    assert f.startswith("crop=")
    assert "scale=1080:1920" in f
    assert not plan.is_dynamic


def test_get_reframer_defaults_static():
    assert get_reframer("nonsense").name == "static"
    assert get_reframer("face").name == "face"
