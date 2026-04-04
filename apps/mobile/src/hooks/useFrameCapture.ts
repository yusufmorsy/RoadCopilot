import { useEffect, useRef } from "react";
import type { ImagePayload } from "@roadcopilot/contracts";

import {
  analyzeFrame,
  type AnalyzeFrameOutcome,
} from "../services/visionClient";

export type CaptureDimensions = { width: number; height: number };

export type UseFrameCaptureOptions = {
  enabled: boolean;
  /** Wait until camera reports ready before ticking. */
  cameraReady: boolean;
  /** Target interval between capture attempts (ms). */
  intervalMs?: number;
  captureFrame: () => Promise<
    { base64: string } & CaptureDimensions | null | undefined
  >;
  onOutcome: (outcome: AnalyzeFrameOutcome) => void;
  /** Fired when a capture+network round-trip starts or ends (for UI status). */
  onInFlightChange?: (inFlight: boolean) => void;
};

function makeRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Periodically captures a frame and POSTs it to `/analyze-frame`.
 * At most one request is in flight: if the previous call has not finished, the next tick is skipped (no queue).
 */
export function useFrameCapture(options: UseFrameCaptureOptions): void {
  const {
    enabled,
    cameraReady,
    intervalMs = 600,
    captureFrame,
    onOutcome,
    onInFlightChange,
  } = options;

  const inFlightRef = useRef(false);
  const captureRef = useRef(captureFrame);
  const onOutcomeRef = useRef(onOutcome);
  const onInFlightChangeRef = useRef(onInFlightChange);

  captureRef.current = captureFrame;
  onOutcomeRef.current = onOutcome;
  onInFlightChangeRef.current = onInFlightChange;

  useEffect(() => {
    if (!enabled || !cameraReady) return;

    const tick = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      onInFlightChangeRef.current?.(true);
      try {
        const shot = await captureRef.current();
        if (!shot?.base64) {
          onOutcomeRef.current({
            ok: false,
            kind: "validation",
            message: "Could not read a frame from the camera.",
          });
          return;
        }

        const image: ImagePayload = {
          contentType: "image/jpeg",
          dataBase64: shot.base64,
        };

        const body = {
          requestId: makeRequestId(),
          image,
          captureMetadata: {
            width: shot.width,
            height: shot.height,
            timestampUtc: new Date().toISOString(),
          },
        };

        const outcome = await analyzeFrame(body);
        onOutcomeRef.current(outcome);
      } catch {
        onOutcomeRef.current({
          ok: false,
          kind: "network",
          message: "Something went wrong while sending a frame.",
        });
      } finally {
        inFlightRef.current = false;
        onInFlightChangeRef.current?.(false);
      }
    };

    const id = setInterval(() => {
      void tick();
    }, intervalMs);

    return () => clearInterval(id);
  }, [enabled, cameraReady, intervalMs]);
}
