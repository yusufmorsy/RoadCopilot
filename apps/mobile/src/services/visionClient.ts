import type {
  AnalyzeFrameRequest,
  AnalyzeFrameResponse,
} from "@roadcopilot/contracts";

import { getVisionAnalyzeTimeoutMs, getVisionApiBaseUrl } from "../config/expoPublicEnv";
import { logRoadCopilotVision } from "../debug/visionCaptureDiagnostics";

export {
  getVisionApiBaseUrl,
  getVisionAnalyzeTimeoutMs,
  isVisionApiConfigured,
} from "../config/expoPublicEnv";

export type AnalyzeFrameOutcome =
  | { ok: true; data: AnalyzeFrameResponse }
  | {
      ok: false;
      kind: "network" | "timeout" | "http" | "parse" | "validation";
      message: string;
    };

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isLaneAdvisorySeverity(
  x: unknown
): x is AnalyzeFrameResponse["advisory"]["severity"] {
  return x === "info" || x === "notice" || x === "caution";
}

/**
 * Best-effort runtime check; narrows to the contract shape for typing.
 */
export function parseAnalyzeFrameResponse(json: unknown): AnalyzeFrameResponse | null {
  if (!isRecord(json)) return null;
  const requestId = json.requestId;
  const processedAt = json.processedAt;
  const lane = json.lane;
  const advisory = json.advisory;
  if (typeof requestId !== "string" || typeof processedAt !== "string") return null;
  if (!isRecord(lane) || !isRecord(advisory)) return null;
  if (typeof lane.detected !== "boolean" || typeof lane.confidence !== "number") {
    return null;
  }
  const offsetNorm = lane.offsetNorm;
  if (
    offsetNorm !== undefined &&
    offsetNorm !== null &&
    typeof offsetNorm !== "number"
  ) {
    return null;
  }
  const message = advisory.message;
  const severity = advisory.severity;
  if (typeof message !== "string" || !isLaneAdvisorySeverity(severity)) return null;

  return {
    requestId,
    processedAt,
    lane: {
      detected: lane.detected,
      confidence: lane.confidence,
      ...(offsetNorm === undefined || offsetNorm === null
        ? {}
        : { offsetNorm }),
    },
    advisory: { message, severity },
  };
}

export type AnalyzeFrameOptions = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function analyzeFrame(
  body: AnalyzeFrameRequest,
  options?: AnalyzeFrameOptions
): Promise<AnalyzeFrameOutcome> {
  const baseUrl = getVisionApiBaseUrl();
  if (!baseUrl) {
    return {
      ok: false,
      kind: "validation",
      message:
        "Vision API URL is not set. Add EXPO_PUBLIC_VISION_API_URL to apps/mobile/.env (see .env.example).",
    };
  }
  const url = `${baseUrl}/analyze-frame`;
  const timeoutMs = options?.timeoutMs ?? getVisionAnalyzeTimeoutMs();

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  options?.signal?.addEventListener("abort", onAbort);

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let payload: string;
  try {
    payload = JSON.stringify(body);
  } catch {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onAbort);
    return {
      ok: false,
      kind: "validation",
      message:
        "This photo was too large to send as one request. The app will keep trying with the next frame.",
    };
  }

  if (__DEV__) {
    logRoadCopilotVision("lane_vision_analyze_fetch_start", {
      path: "/analyze-frame",
      timeoutMs,
      payloadChars: payload.length,
      requestId: body.requestId,
    });
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: payload,
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      return {
        ok: false,
        kind: "parse",
        message: "The analysis service returned data we could not read.",
      };
    }

    if (!res.ok) {
      let detail = text.slice(0, 200);
      if (isRecord(parsed) && parsed.detail !== undefined) {
        const d = parsed.detail;
        if (typeof d === "string") detail = d;
        else if (Array.isArray(d))
          detail = d.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join("; ");
      }
      return {
        ok: false,
        kind: "http",
        message: `Service error (${res.status}). ${detail}`.trim(),
      };
    }

    const data = parseAnalyzeFrameResponse(parsed);
    if (!data) {
      return {
        ok: false,
        kind: "validation",
        message: "The analysis service returned an unexpected response shape.",
      };
    }

    if (data.requestId !== body.requestId) {
      return {
        ok: false,
        kind: "validation",
        message: "Response did not match this request. Try again.",
      };
    }

    return { ok: true, data };
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "AbortError") {
      return {
        ok: false,
        kind: "timeout",
        message:
          `No response within ${Math.round(timeoutMs / 1000)}s — the phone may not reach your Mac on this network, or the vision server is down. Check Wi‑Fi and uvicorn. You can raise EXPO_PUBLIC_VISION_ANALYZE_TIMEOUT_MS in .env if uploads are legitimately slow.`,
      };
    }
    return {
      ok: false,
      kind: "network",
      message:
        "Could not reach the vision server. On a real device use your computer's Wi‑Fi IP (not localhost), start the API with --host 0.0.0.0, same Wi‑Fi. Android emulator: http://10.0.2.2:8000",
    };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onAbort);
  }
}
