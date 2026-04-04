"""
RoadCopilot vision API — scaffold only.

Request/response shapes must stay aligned with `packages/contracts` (TypeScript + JSON Schema).
Lane MVP: classical OpenCV only (no deep learning) per project rules.
"""

from __future__ import annotations

import base64
from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field

from lane_opencv import advisory_for_lane, analyze_lane_from_image_bytes


class ContractModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class ImagePayload(ContractModel):
    content_type: Literal["image/jpeg", "image/png"] = Field(alias="contentType")
    data_base64: str = Field(alias="dataBase64")


class AnalyzeFrameRequest(ContractModel):
    request_id: str = Field(alias="requestId")
    image: ImagePayload
    capture_metadata: dict | None = Field(default=None, alias="captureMetadata")


class LaneOverlayPoint(ContractModel):
    x: int
    y: int


class LaneOverlaySegment(ContractModel):
    x1: int
    y1: int
    x2: int
    y2: int


class LaneOverlay(ContractModel):
    width: int
    height: int
    roi: list[LaneOverlayPoint] | None = None
    segments: list[LaneOverlaySegment] | None = None
    left_boundary: list[LaneOverlaySegment] | None = Field(
        default=None, alias="leftBoundary"
    )
    right_boundary: list[LaneOverlaySegment] | None = Field(
        default=None, alias="rightBoundary"
    )


class LaneResult(ContractModel):
    detected: bool
    offset_norm: float | None = Field(default=None, alias="offsetNorm")
    confidence: float
    overlay: LaneOverlay | None = None


class Advisory(ContractModel):
    message: str
    severity: Literal["info", "notice", "caution"]


class AnalyzeFrameResponse(ContractModel):
    request_id: str = Field(alias="requestId")
    processed_at: str = Field(alias="processedAt")
    lane: LaneResult
    advisory: Advisory


class VideoUploadSource(ContractModel):
    kind: Literal["uploadId"]
    upload_id: str = Field(alias="uploadId")


class VideoUrlSource(ContractModel):
    kind: Literal["url"]
    url: str


class AnalyzeVideoReplayRequest(ContractModel):
    request_id: str = Field(alias="requestId")
    video: VideoUploadSource | VideoUrlSource
    options: dict | None = None


class ReplaySummary(ContractModel):
    drift_advisory_count: int = Field(alias="driftAdvisoryCount")
    narrative: str


class AnalyzeVideoReplayResponse(ContractModel):
    request_id: str = Field(alias="requestId")
    processed_at: str = Field(alias="processedAt")
    frames_analyzed: int = Field(alias="framesAnalyzed")
    summary: ReplaySummary


app = FastAPI(title="RoadCopilot Vision API", version="0.0.1")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze-frame", response_model=AnalyzeFrameResponse)
def analyze_frame(body: AnalyzeFrameRequest) -> AnalyzeFrameResponse:
    """Classical OpenCV lane cues on each frame — no GPS or speed required."""
    now = datetime.now(timezone.utc).isoformat()
    try:
        raw = base64.b64decode(body.image.data_base64, validate=True)
    except (ValueError, TypeError):
        return AnalyzeFrameResponse(
            requestId=body.request_id,
            processedAt=now,
            lane=LaneResult(detected=False, offsetNorm=None, confidence=0.0),
            advisory=Advisory(
                message="We could not read that image — if it happens again, try a quick restart of the drive screen.",
                severity="notice",
            ),
        )

    est, overlay_dict = analyze_lane_from_image_bytes(raw)
    msg, sev = advisory_for_lane(est)
    overlay_model: LaneOverlay | None = None
    if overlay_dict:
        try:
            overlay_model = LaneOverlay.model_validate(overlay_dict)
        except Exception:
            overlay_model = None

    return AnalyzeFrameResponse(
        requestId=body.request_id,
        processedAt=now,
        lane=LaneResult(
            detected=est.detected,
            offset_norm=est.offset_norm,
            confidence=est.confidence,
            overlay=overlay_model,
        ),
        advisory=Advisory(message=msg, severity=sev),
    )


@app.post("/analyze-video-replay", response_model=AnalyzeVideoReplayResponse)
def analyze_video_replay(body: AnalyzeVideoReplayRequest) -> AnalyzeVideoReplayResponse:
    """Stub: sample frames from upload/URL and reuse lane logic."""
    now = datetime.now(timezone.utc).isoformat()
    return AnalyzeVideoReplayResponse(
        requestId=body.request_id,
        processedAt=now,
        framesAnalyzed=0,
        summary=ReplaySummary(
            driftAdvisoryCount=0,
            narrative="Replay mode: processing will start once video ingestion is implemented.",
        ),
    )
