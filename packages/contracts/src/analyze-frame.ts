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

export interface AnalyzeFrameResponse {
  requestId: string;
  /** ISO 8601 when the server finished processing. */
  processedAt: string;
  lane: {
    detected: boolean;
    /** Normalized lateral offset from lane center, roughly -1..1 when detected. */
    offsetNorm?: number;
    confidence: number;
  };
  /** Spoken or UI advisory — calm, elder-appropriate. */
  advisory: {
    message: string;
    severity: LaneAdvisorySeverity;
  };
}
