/**
 * POST /analyze-frame — single frame lane analysis (OpenCV / classical CV, no DL for MVP).
 */
export interface ImagePayload {
  contentType: "image/jpeg" | "image/png";
  dataBase64: string;
}

export interface AnalyzeFrameRequest {
  requestId: string;
  image: ImagePayload;
  /** Optional: device-reported capture metadata for debugging correlation. */
  captureMetadata?: {
    width?: number;
    height?: number;
    timestampUtc?: string;
  };
}

export type LaneAdvisorySeverity = "info" | "notice" | "caution";

/** One line segment in pixel space of {@link LaneOverlay.width} × {@link LaneOverlay.height}. */
export interface LaneOverlaySegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface LaneOverlayPoint {
  x: number;
  y: number;
}

/**
 * Classical-CV debug overlay: ROI and Hough segments in **analysis image** coordinates
 * (same pixel size as the server-side resized frame, typically ≤640px wide).
 */
export interface LaneOverlay {
  width: number;
  height: number;
  /** Road-region trapezoid used for edge search. */
  roi?: LaneOverlayPoint[];
  /** Raw line candidates from edge detection (faint). */
  segments?: LaneOverlaySegment[];
  /** Segments classified as left-lane boundary. */
  leftBoundary?: LaneOverlaySegment[];
  /** Segments classified as right-lane boundary. */
  rightBoundary?: LaneOverlaySegment[];
}

export interface AnalyzeFrameResponse {
  requestId: string;
  /** ISO 8601 when the server finished processing. */
  processedAt: string;
  lane: {
    detected: boolean;
    /** Normalized lateral offset from lane center, roughly -1..1 when detected. */
    offsetNorm?: number;
    confidence: number;
    /** Optional geometry for drawing lane cues on the camera preview. */
    overlay?: LaneOverlay;
  };
  /** Spoken or UI advisory — calm, elder-appropriate. */
  advisory: {
    message: string;
    severity: LaneAdvisorySeverity;
  };
}
