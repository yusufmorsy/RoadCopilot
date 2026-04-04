/**
 * POST /analyze-video-replay — backup demo/replay path when live camera is unavailable.
 */
export type VideoReplaySource =
  | { kind: "uploadId"; uploadId: string }
  | { kind: "url"; url: string };

export interface AnalyzeVideoReplayRequest {
  requestId: string;
  video: VideoReplaySource;
  options?: {
    /** Cap frames processed for cost/latency control. */
    maxFrames?: number;
    /** Sample rate hint, e.g. 1 = every frame, 2 = every second frame. */
    frameStride?: number;
  };
}

export interface AnalyzeVideoReplayResponse {
  requestId: string;
  processedAt: string;
  framesAnalyzed: number;
  /** Aggregate lane advisory summary for the replay session. */
  summary: {
    driftAdvisoryCount: number;
    /** Calm summary line for UI or TTS in demo mode. */
    narrative: string;
  };
}
