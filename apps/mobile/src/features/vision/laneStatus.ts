import type { AnalyzeFrameResponse } from "@roadcopilot/contracts";

export type LaneDisplayStatus =
  | "centered"
  | "drifting_left"
  | "drifting_right"
  | "unknown";

/**
 * |offsetNorm| above this → drifting (below → "In lane"). Server normalizes roughly to ±1.
 * Was 0.22 (very wide); smaller = more sensitive to slight left/right cues.
 */
const DEFAULT_OFFSET_THRESHOLD = 0.10;
const MIN_CONFIDENCE = 0.35;

export type LaneUiState = {
  status: LaneDisplayStatus;
  /** Latest server offset when meaningful; undefined when unknown. */
  offsetNorm?: number;
  /** 0–1 from server when present. */
  confidence: number;
  detected: boolean;
};

/**
 * Map contract lane fields to a simple, elder-friendly lane status.
 * Negative offset → left of center; positive → right (per contract comment).
 */
export function laneResponseToUiState(
  response: AnalyzeFrameResponse | null,
  options?: { offsetThreshold?: number; minConfidence?: number }
): LaneUiState {
  const offsetThreshold = options?.offsetThreshold ?? DEFAULT_OFFSET_THRESHOLD;
  const minConfidence = options?.minConfidence ?? MIN_CONFIDENCE;

  if (!response) {
    return {
      status: "unknown",
      confidence: 0,
      detected: false,
    };
  }

  const { lane } = response;
  if (!lane.detected || lane.confidence < minConfidence) {
    return {
      status: "unknown",
      confidence: lane.confidence,
      detected: lane.detected,
    };
  }

  const o = lane.offsetNorm;
  if (o === undefined || Number.isNaN(o)) {
    return {
      status: "unknown",
      confidence: lane.confidence,
      detected: true,
    };
  }

  if (o < -offsetThreshold) {
    return {
      status: "drifting_left",
      offsetNorm: o,
      confidence: lane.confidence,
      detected: true,
    };
  }
  if (o > offsetThreshold) {
    return {
      status: "drifting_right",
      offsetNorm: o,
      confidence: lane.confidence,
      detected: true,
    };
  }

  return {
    status: "centered",
    offsetNorm: o,
    confidence: lane.confidence,
    detected: true,
  };
}

export function laneStatusLabel(status: LaneDisplayStatus): string {
  switch (status) {
    case "centered":
      return "Centered";
    case "drifting_left":
      return "Drifting left";
    case "drifting_right":
      return "Drifting right";
    default:
      return "Unknown";
  }
}

/** Short labels for the drive UI and logs (in lane / veering / not available). */
export function laneStatusDriverLabel(status: LaneDisplayStatus): string {
  switch (status) {
    case "centered":
      return "In lane";
    case "drifting_left":
      return "Veering left";
    case "drifting_right":
      return "Veering right";
    default:
      return "N/A";
  }
}
