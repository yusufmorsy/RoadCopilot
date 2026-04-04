import { useEffect, useRef } from "react";
import type { ImagePayload } from "@roadcopilot/contracts";

import {
  logRoadCopilotVision,
  serializeUnknownError,
} from "../debug/visionCaptureDiagnostics";
import {
  analyzeFrame,
  type AnalyzeFrameOutcome,
} from "../services/visionClient";

export type CaptureDimensions = { width: number; height: number };

/** Present when a still was decoded; use with successful outcomes to align CV overlay with the preview. */
export type AnalyzeFrameOutcomeContext = {
  capture: CaptureDimensions;
};

export type UseFrameCaptureOptions = {
  enabled: boolean;
  /** Wait until camera reports ready before ticking. */
  cameraReady: boolean;
  /** Milliseconds to wait after each full cycle (capture + POST) before starting the next. */
  intervalMs?: number;
  captureFrame: () => Promise<
    { base64: string } & CaptureDimensions | null | undefined
  >;
  onOutcome: (
    outcome: AnalyzeFrameOutcome,
    context?: AnalyzeFrameOutcomeContext
  ) => void;
  /** Fired when a capture+network round-trip starts or ends (for UI status). */
  onInFlightChange?: (inFlight: boolean) => void;
};

function makeRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Captures a frame and POSTs it to `/analyze-frame`, then waits `intervalMs` before the next cycle.
 * Only one cycle runs at a time (no queue).
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

  const captureRef = useRef(captureFrame);
  const onOutcomeRef = useRef(onOutcome);
  const onInFlightChangeRef = useRef(onInFlightChange);

  captureRef.current = captureFrame;
  onOutcomeRef.current = onOutcome;
  onInFlightChangeRef.current = onInFlightChange;

  const cycleRef = useRef(0);

  useEffect(() => {
    if (!enabled || !cameraReady) {
      logRoadCopilotVision("lane_frame_loop_idle", {
        enabled,
        cameraReady,
        note: "capture loop not running until both are true",
      });
      return;
    }

    cycleRef.current = 0;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    logRoadCopilotVision("lane_frame_loop_armed", {
      intervalMs,
      note: "first cycle runs immediately via schedule(0)",
    });

    const schedule = (delayMs: number, afterCycle: number) => {
      if (cancelled) return;
      if (timeoutId !== null) clearTimeout(timeoutId);
      logRoadCopilotVision("lane_frame_schedule_next", {
        afterCycle,
        delayMs,
      });
      timeoutId = setTimeout(() => {
        timeoutId = null;
        void tick();
      }, delayMs);
    };

    const tick = async () => {
      if (cancelled) return;
      const cycle = ++cycleRef.current;
      logRoadCopilotVision("lane_frame_tick_start", { cycle, intervalMs });

      onInFlightChangeRef.current?.(true);
      try {
        let shot: Awaited<ReturnType<typeof captureRef.current>>;
        const captureStarted = Date.now();
        logRoadCopilotVision("lane_frame_capture_begin", { cycle });
        try {
          shot = await captureRef.current();
        } catch (e) {
          logRoadCopilotVision("lane_frame_capture_threw", {
            cycle,
            captureMs: Date.now() - captureStarted,
            ...serializeUnknownError(e),
          });
          const detail =
            e instanceof Error && e.message
              ? ` ${e.message.slice(0, 140)}${e.message.length > 140 ? "…" : ""}`
              : "";
          onOutcomeRef.current(
            {
              ok: false,
              kind: "validation",
              message: `Could not capture a photo.${detail}`,
            },
            undefined
          );
          return;
        }

        const captureMs = Date.now() - captureStarted;
        if (cancelled) return;

        if (!shot?.base64) {
          logRoadCopilotVision("lane_frame_capture_miss", {
            cycle,
            captureMs,
            reason: shot ? "no_base64_in_result" : "null_shot",
            width: shot?.width ?? null,
            height: shot?.height ?? null,
            hasUri: Boolean(shot && "uri" in shot && shot.uri),
          });
          if (shot) {
            logRoadCopilotVision("lane_frame_capture_empty", {
              phase: "missing_base64_after_non_null_shot",
              width: shot.width ?? null,
              height: shot.height ?? null,
            });
          }
          onOutcomeRef.current(
            {
              ok: false,
              kind: "validation",
              message: "Could not read a frame from the camera.",
            },
            undefined
          );
          return;
        }

        logRoadCopilotVision("lane_frame_capture_ok", {
          cycle,
          captureMs,
          width: shot.width,
          height: shot.height,
          base64Length: shot.base64.length,
        });

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

        const analyzeStarted = Date.now();
        logRoadCopilotVision("lane_frame_analyze_begin", {
          cycle,
          requestId: body.requestId,
        });
        const outcome = await analyzeFrame(body);
        const analyzeMs = Date.now() - analyzeStarted;
        logRoadCopilotVision("lane_frame_analyze_end", {
          cycle,
          requestId: body.requestId,
          ok: outcome.ok,
          analyzeMs,
          ...(outcome.ok ? {} : { kind: outcome.kind }),
          ...(!outcome.ok ? { messagePreview: outcome.message.slice(0, 120) } : {}),
        });
        if (cancelled) return;
        const captureContext: AnalyzeFrameOutcomeContext = {
          capture: { width: shot.width, height: shot.height },
        };
        onOutcomeRef.current(outcome, captureContext);
      } catch (e) {
        if (cancelled) return;
        logRoadCopilotVision("lane_frame_loop_unexpected", {
          cycle,
          phase: "after_capture_or_network",
          ...serializeUnknownError(e),
        });
        const detail =
          e instanceof Error && e.message
            ? ` ${e.message.slice(0, 140)}${e.message.length > 140 ? "…" : ""}`
            : "";
        onOutcomeRef.current(
          {
            ok: false,
            kind: "network",
            message: `Something went wrong while sending a frame.${detail}`,
          },
          undefined
        );
      } finally {
        onInFlightChangeRef.current?.(false);
        if (!cancelled) schedule(intervalMs, cycleRef.current);
      }
    };

    schedule(0, 0);

    return () => {
      cancelled = true;
      logRoadCopilotVision("lane_frame_loop_disarmed", {
        lastCycle: cycleRef.current,
      });
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [enabled, cameraReady, intervalMs]);
}
