import { Platform } from "react-native";

import { logRoadCopilotVision } from "./visionCaptureDiagnostics";

/**
 * Debug-mode NDJSON ingest (session 3c1ad4). On Android emulator/device, host ingest is reachable
 * after: adb reverse tcp:7323 tcp:7323
 */
export function agentDebugLog(
  location: string,
  message: string,
  hypothesisId: string,
  data: Record<string, unknown>,
  runId = "pre-fix"
): void {
  if (!__DEV__) return;
  const payload = {
    sessionId: "3c1ad4",
    runId,
    hypothesisId,
    location,
    message,
    data: { ...data, platform: Platform.OS },
    timestamp: Date.now(),
  };
  // #region agent log
  fetch("http://127.0.0.1:7323/ingest/66355daa-5c2a-4a7b-9d0d-22279e981e5c", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "3c1ad4",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
  // #endregion
  logRoadCopilotVision("debug_agent_ingest_mirror", {
    hypothesisId,
    location,
    message,
    ...data,
  });
}
