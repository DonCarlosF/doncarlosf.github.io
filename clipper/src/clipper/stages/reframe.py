"""Stage 5 — Reframe to 9:16 (swappable).

A Reframer computes a CropPlan for a clip span. Two strategies ship:

  * StaticCenterReframer — fixed centered crop. Robust default (MVP).
  * FaceTrackReframer    — mediapipe face detection sampled across the span,
    crop center smoothed with an exponential moving average (EMA) to kill
    jitter; falls back to centered crop if no confident track.

CropPlan emits an ffmpeg `crop` filter (static or a t-keyed expression), so
the rendering stage stays agnostic to which strategy produced it. Reference:
Google AutoFlip / TalkNet-ASD for a fuller active-speaker model.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from ..logconf import get

log = get(__name__)

AR = {"9:16": 9 / 16, "1:1": 1.0, "16:9": 16 / 9}
TARGET_SIZE = {"9:16": (1080, 1920), "1:1": (1080, 1080), "16:9": (1920, 1080)}


def compute_crop_dims(src_w: int, src_h: int, target_ar: float) -> tuple[int, int]:
    """Largest crop of the source matching target aspect ratio (even dims)."""
    src_ar = src_w / src_h
    if src_ar > target_ar:  # too wide -> crop width
        cw, ch = int(round(src_h * target_ar)), src_h
    else:  # too tall -> crop height
        cw, ch = src_w, int(round(src_w / target_ar))
    return cw - (cw % 2), ch - (ch % 2)


@dataclass
class CropPlan:
    src_w: int
    src_h: int
    crop_w: int
    crop_h: int
    aspect: str = "9:16"
    y: int = 0
    static_x: Optional[int] = None
    # (relative_time_seconds, x) keyframes for dynamic tracking
    keyframes: list[tuple[float, int]] = field(default_factory=list)

    @property
    def is_dynamic(self) -> bool:
        return self.static_x is None and len(self.keyframes) > 1

    def _x_expr(self) -> str:
        if not self.is_dynamic:
            x = self.static_x if self.static_x is not None else (self.src_w - self.crop_w) // 2
            return str(int(x))
        # Piecewise-constant over smoothed keyframes; t is clip-relative seconds.
        kfs = self.keyframes
        expr = str(kfs[-1][1])
        for t, x in reversed(kfs[:-1]):
            expr = f"if(lt(t,{t:.2f}),{int(x)},{expr})"
        return expr

    def crop_filter(self) -> str:
        out_w, out_h = TARGET_SIZE.get(self.aspect, (1080, 1920))
        x = self._x_expr()
        return f"crop={self.crop_w}:{self.crop_h}:{x}:{self.y},scale={out_w}:{out_h}"


class Reframer:
    name = "base"

    def plan(self, video: Path, start: float, end: float, src_w: int, src_h: int, aspect: str) -> CropPlan:  # noqa: E501
        raise NotImplementedError


class StaticCenterReframer(Reframer):
    name = "static"

    def plan(self, video, start, end, src_w, src_h, aspect="9:16") -> CropPlan:
        cw, ch = compute_crop_dims(src_w, src_h, AR.get(aspect, AR["9:16"]))
        return CropPlan(
            src_w=src_w,
            src_h=src_h,
            crop_w=cw,
            crop_h=ch,
            aspect=aspect,
            y=(src_h - ch) // 2,
            static_x=(src_w - cw) // 2,
        )


class FaceTrackReframer(Reframer):
    name = "face"

    def __init__(self, sample_fps: float = 2.0, ema_alpha: float = 0.2, min_conf: float = 0.5):
        self.sample_fps = sample_fps
        self.ema_alpha = ema_alpha
        self.min_conf = min_conf

    def plan(self, video, start, end, src_w, src_h, aspect="9:16") -> CropPlan:
        cw, ch = compute_crop_dims(src_w, src_h, AR.get(aspect, AR["9:16"]))
        y = (src_h - ch) // 2
        fallback = StaticCenterReframer().plan(video, start, end, src_w, src_h, aspect)
        try:
            centers = self._sample_face_centers(video, start, end, src_w, src_h)
        except ImportError:
            log.warning("mediapipe/opencv not installed; using centered crop.")
            return fallback
        except Exception as exc:  # pragma: no cover - runtime/codec dependent
            log.warning("Face tracking failed (%s); using centered crop.", exc)
            return fallback

        confident = [c for c in centers if c is not None]
        if len(confident) < max(2, 0.3 * len(centers)):
            log.info("Low-confidence face track; using centered crop.")
            return fallback

        # EMA smoothing + clamp to frame; hold last known center through gaps.
        keyframes: list[tuple[float, int]] = []
        smoothed: Optional[float] = None
        last = src_w / 2
        for i, c in enumerate(centers):
            cx = c if c is not None else last
            last = cx
            smoothed = cx if smoothed is None else (self.ema_alpha * cx + (1 - self.ema_alpha) * smoothed)
            x = int(max(0, min(src_w - cw, smoothed - cw / 2)))
            keyframes.append((i / self.sample_fps, x))
        return CropPlan(src_w=src_w, src_h=src_h, crop_w=cw, crop_h=ch, aspect=aspect, y=y, keyframes=keyframes)  # noqa: E501

    def _sample_face_centers(self, video, start, end, src_w, src_h) -> list[Optional[float]]:
        import cv2  # type: ignore
        import mediapipe as mp  # type: ignore

        cap = cv2.VideoCapture(str(video))
        detector = mp.solutions.face_detection.FaceDetection(min_detection_confidence=self.min_conf)
        centers: list[Optional[float]] = []
        t = start
        step = 1.0 / self.sample_fps
        try:
            while t < end:
                cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000.0)
                ok, frame = cap.read()
                if not ok:
                    break
                res = detector.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                if res.detections:
                    # widest-box detection = closest/active speaker heuristic
                    best = max(res.detections, key=lambda d: d.location_data.relative_bounding_box.width)
                    box = best.location_data.relative_bounding_box
                    centers.append((box.xmin + box.width / 2) * src_w)
                else:
                    centers.append(None)
                t += step
        finally:
            cap.release()
            detector.close()
        return centers


def get_reframer(name: str) -> Reframer:
    return {"static": StaticCenterReframer, "face": FaceTrackReframer}.get(
        name, StaticCenterReframer
    )()
