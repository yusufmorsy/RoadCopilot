"""
RoadCopilot vision API — scaffold only.

Request/response shapes must stay aligned with `packages/contracts` (TypeScript + JSON Schema).
Lane MVP: classical OpenCV only (no deep learning) per project rules.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field


class ContractModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, ser_json_by_alias=True)


class ImagePayload(ContractModel):
    content_type: Literal["image/jpeg", "image/png"] = Field(alias="contentType")
    data_base64: str = Field(alias="dataBase64")


class AnalyzeFrameRequest(ContractModel):
    request_id: str = Field(alias="requestId")
    image: ImagePayload
    capture_metadata: dict | None = Field(default=None, alias="captureMetadata")


class LaneResult(ContractModel):
    detected: bool
    offset_norm: float | None = Field(default=None, alias="offsetNorm")
    confidence: float


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
    """Stub: wire OpenCV lane pipeline here; keep messages calm and advisory."""
    now = datetime.now(timezone.utc).isoformat()
    return AnalyzeFrameResponse(
        requestId=body.request_id,
        processedAt=now,
        lane=LaneResult(detected=False, offsetNorm=None, confidence=0.0),
        advisory=Advisory(
            message="RoadCopilot is getting ready—lane assist will appear when the road lines are visible.",
            severity="info",
        ),
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
