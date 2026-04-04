import type {
  AnalyzeFrameRequest,
  AnalyzeFrameResponse,
} from "@roadcopilot/contracts";

import { getVisionApiBaseUrl } from "../config/expoPublicEnv";

const DEFAULT_TIMEOUT_MS = 12_000;

export { getVisionApiBaseUrl, isVisionApiConfigured } from "../config/expoPublicEnv";

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
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  options?.signal?.addEventListener("abort", onAbort);

  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
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
        message: "The analysis service took too long or was stopped.",
      };
    }
    return {
      ok: false,
      kind: "network",
      message: "We could not reach the analysis service. Check your connection and server address.",
    };
  } finally {
    clearTimeout(timer);
    options?.signal?.removeEventListener("abort", onAbort);
  }
}
