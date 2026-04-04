import { Platform } from "react-native";

const TAG = "[RoadCopilot:speech]";

/**
 * Dev-only logs for TTS (trip briefing, route hints, lane cues).
 * Phrases are truncated; no secrets.
 */
export function logRoadCopilotSpeech(
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

/** Safe preview for Metro / device logs. */
export function phrasePreview(text: string, max = 80): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
