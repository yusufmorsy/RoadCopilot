"""
Classical lane-ish cues from a single forward-looking frame (OpenCV only).

No vehicle speed is used — stationary capture (e.g. phone on a desk filming a screen)
still runs the same math. Quality depends on visible road edges / lane markings.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

import cv2
import numpy as np

AdvisorySeverity = Literal["info", "notice", "caution"]

_MAX_OVERLAY_SEGMENTS = 48


@dataclass(frozen=True)
class LaneEstimate:
    detected: bool
    offset_norm: float | None
    confidence: float


def _decode_bgr(image_bytes: bytes) -> np.ndarray | None:
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img


def _seg_dict(x1: int, y1: int, x2: int, y2: int) -> dict[str, int]:
    return {"x1": int(x1), "y1": int(y1), "x2": int(x2), "y2": int(y2)}


def _roi_points(w: int, h: int, top_y: int, mid_x: int) -> list[dict[str, int]]:
    return [
        {"x": 0, "y": h - 1},
        {"x": w - 1, "y": h - 1},
        {"x": int(mid_x + w * 0.12), "y": top_y},
        {"x": int(mid_x - w * 0.12), "y": top_y},
    ]


def analyze_lane_from_image_bytes(
    image_bytes: bytes, max_width: int = 640
) -> tuple[LaneEstimate, dict[str, Any] | None]:
    """
    Rough lane center vs image center at the bottom of a road ROI.
    offset_norm: negative ≈ left of center, positive ≈ right (matches contracts comment).

    Returns (estimate, overlay_dict_or_none) where overlay uses analysis pixel space.
    """
    img = _decode_bgr(image_bytes)
    if img is None or img.size == 0:
        return LaneEstimate(False, None, 0.0), None

    h0, w0 = img.shape[:2]
    if h0 < 80 or w0 < 80:
        return LaneEstimate(False, None, 0.0), None

    scale = min(1.0, max_width / w0)
    if scale < 1.0:
        img = cv2.resize(img, (int(w0 * scale), int(h0 * scale)), interpolation=cv2.INTER_AREA)
    h, w = img.shape[:2]

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 60, 140)

    mask = np.zeros((h, w), dtype=np.uint8)
    top_y = int(h * 0.42)
    mid_x = w // 2
    roi = np.array(
        [
            [
                (0, h - 1),
                (w - 1, h - 1),
                (int(mid_x + w * 0.12), top_y),
                (int(mid_x - w * 0.12), top_y),
            ]
        ],
        dtype=np.int32,
    )
    cv2.fillPoly(mask, roi, 255)
    masked = cv2.bitwise_and(edges, mask)

    lines = cv2.HoughLinesP(
        masked,
        rho=2,
        theta=np.pi / 180,
        threshold=28,
        minLineLength=int(h * 0.08),
        maxLineGap=int(h * 0.04),
    )

    roi_json = _roi_points(w, h, top_y, mid_x)
    segments: list[dict[str, int]] = []
    left_segs: list[dict[str, int]] = []
    right_segs: list[dict[str, int]] = []

    overlay_base: dict[str, Any] = {
        "width": w,
        "height": h,
        "roi": roi_json,
        "segments": segments,
        "leftBoundary": left_segs,
        "rightBoundary": right_segs,
    }

    if lines is None or len(lines) == 0:
        return LaneEstimate(False, None, 0.15), overlay_base

    y_bottom = float(h - 1)
    left_xs: list[float] = []
    right_xs: list[float] = []

    for seg in lines[:, 0]:
        x1, y1, x2, y2 = int(seg[0]), int(seg[1]), int(seg[2]), int(seg[3])
        if abs(y2 - y1) < 8:
            continue
        sd = _seg_dict(x1, y1, x2, y2)
        if len(segments) < _MAX_OVERLAY_SEGMENTS:
            segments.append(sd)

        if y1 > y2:
            x1, y1, x2, y2 = x2, y2, x1, y1
        slope = (x2 - x1) / (float(y2 - y1) + 1e-6)
        if abs(slope) < 0.35 or abs(slope) > 3.5:
            continue
        x_at_bottom = x1 + slope * (y_bottom - y1)
        if slope < -0.35 and x_at_bottom < mid_x + w * 0.15:
            left_xs.append(x_at_bottom)
            if len(left_segs) < 24:
                left_segs.append(sd)
        elif slope > 0.35 and x_at_bottom > mid_x - w * 0.15:
            right_xs.append(x_at_bottom)
            if len(right_segs) < 24:
                right_segs.append(sd)

    if not left_xs and not right_xs:
        return LaneEstimate(False, None, 0.2), overlay_base

    lx = float(np.median(left_xs)) if left_xs else None
    rx = float(np.median(right_xs)) if right_xs else None

    if lx is not None and rx is not None:
        if rx - lx < w * 0.08:
            return LaneEstimate(False, None, 0.25), overlay_base
        center = (lx + rx) / 2.0
        lane_width = rx - lx
        offset = (center - mid_x) / max(lane_width / 2.0, w * 0.06)
        offset = float(np.clip(offset, -1.0, 1.0))
        n = min(len(left_xs), 6) + min(len(right_xs), 6)
        conf = float(np.clip(0.35 + 0.08 * n, 0.35, 0.92))
        return LaneEstimate(True, offset, conf), overlay_base

    assumed_half = w * 0.22
    if lx is not None and rx is None:
        center = lx + assumed_half
        offset = (center - mid_x) / assumed_half
        conf = float(np.clip(0.38 + 0.05 * min(len(left_xs), 8), 0.38, 0.75))
    elif rx is not None and lx is None:
        center = rx - assumed_half
        offset = (center - mid_x) / assumed_half
        conf = float(np.clip(0.38 + 0.05 * min(len(right_xs), 8), 0.38, 0.75))
    else:
        return LaneEstimate(False, None, 0.22), overlay_base

    offset = float(np.clip(offset, -1.0, 1.0))
    return LaneEstimate(True, offset, conf), overlay_base


def advisory_for_lane(est: LaneEstimate) -> tuple[str, AdvisorySeverity]:
    """(message, severity) — calm, advisory."""
    if not est.detected:
        return (
            "We could not pick up clear lane lines in this frame — try a clearer view of the road when you can.",
            "info",
        )
    # Keep in sync with mobile `laneStatus.ts` DEFAULT_OFFSET_THRESHOLD (advisory tone).
    advisory_offset = 0.07
    o = est.offset_norm or 0.0
    if o < -advisory_offset:
        return (
            "Lane cues suggest you may be a little left of center — ease toward the middle when it feels comfortable.",
            "notice",
        )
    if o > advisory_offset:
        return (
            "Lane cues suggest you may be a little right of center — ease toward the middle when it feels comfortable.",
            "notice",
        )
    return (
        "Lane lines look reasonably centered in this view.",
        "info",
    )
