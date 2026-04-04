import { Platform } from "react-native";

const TAG = "[RoadCopilot:vision]";

/**
 * Dev-only structured logs for lane capture / vision API issues.
 * Never pass base64, full URLs with secrets, or full request bodies here.
 */
export function serializeUnknownError(e: unknown): Record<string, string | undefined> {
  if (e instanceof Error) {
    return {
      name: e.name,
      message: e.message?.slice(0, 500),
    };
  }
  if (typeof e === "string") {
    return { message: e.slice(0, 500) };
  }
  try {
    return { stringified: JSON.stringify(e).slice(0, 500) };
  } catch {
    return { stringified: String(e).slice(0, 500) };
  }
}

export function logRoadCopilotVision(
  event: string,
  data?: Record<string, unknown>
): void {
  if (!__DEV__) return;
  const payload = {
    at: new Date().toISOString(),
    platform: Platform.OS,
    ...data,
  };
  console.warn(TAG, event, payload);
}
