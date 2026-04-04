import * as Speech from "expo-speech";
import { Platform } from "react-native";

import {
  logRoadCopilotSpeech,
  phrasePreview,
} from "../../debug/speechDiagnostics";

const LANE_RECENT_MS = 2_500;

let lastLaneSpeakAt = 0;

export function markLaneSpokeNow(): void {
  lastLaneSpeakAt = Date.now();
}

export function laneSpokeRecently(): boolean {
  return Date.now() - lastLaneSpeakAt < LANE_RECENT_MS;
}

const BASE_RATE = 0.92 as const;
const BASE_PITCH = 1 as const;

function speechOptions(
  kind: "lane" | "route" | "briefing",
  phrase: string
): Speech.SpeechOptions {
  const prev = phrasePreview(phrase);
  return {
    rate: BASE_RATE,
    pitch: BASE_PITCH,
    /**
     * Separate iOS audio session so TTS is less likely to be ducked or silent when
     * other sessions (e.g. media) are active.
     */
    ...(Platform.OS === "ios"
      ? { useApplicationAudioSession: false as const }
      : {}),
    onStart: () => {
      logRoadCopilotSpeech("speech_onStart", { kind, phrasePreview: prev });
    },
    onDone: () => {
      logRoadCopilotSpeech("speech_onDone", { kind, phrasePreview: prev });
    },
    onStopped: () => {
      logRoadCopilotSpeech("speech_onStopped", { kind, phrasePreview: prev });
    },
    onError: (error: Error) => {
      logRoadCopilotSpeech("speech_onError", {
        kind,
        phrasePreview: prev,
        errorMessage: error?.message?.slice(0, 200),
        errorName: error?.name,
      });
    },
  };
}

/**
 * Lane drift cues: preempt other speech (same as prior direct Speech usage).
 */
export function speakLane(phrase: string): void {
  logRoadCopilotSpeech("speak_lane_invoke", {
    phrasePreview: phrasePreview(phrase),
    charLength: phrase.length,
  });
  Speech.stop();
  Speech.speak(phrase, speechOptions("lane", phrase));
  markLaneSpokeNow();
}

/**
 * Route hints: skip while lane is actively drifting, or right after a lane line.
 */
export function speakRoute(
  phrase: string,
  isLaneDrifting: boolean
): boolean {
  if (isLaneDrifting) {
    logRoadCopilotSpeech("speak_route_skipped", {
      reason: "lane_drifting",
      phrasePreview: phrasePreview(phrase),
    });
    return false;
  }
  if (laneSpokeRecently()) {
    logRoadCopilotSpeech("speak_route_skipped", {
      reason: "lane_spoke_recently",
      phrasePreview: phrasePreview(phrase),
      laneRecentMs: LANE_RECENT_MS,
    });
    return false;
  }
  logRoadCopilotSpeech("speak_route_invoke", {
    phrasePreview: phrasePreview(phrase),
    charLength: phrase.length,
  });
  Speech.stop();
  Speech.speak(phrase, speechOptions("route", phrase));
  return true;
}

/**
 * Trip-start ETA / welcome line — always plays on iPhone so it is not dropped when
 * lane status is still "unknown" vs drifting during the first frames.
 */
export function speakTripBriefing(phrase: string): void {
  logRoadCopilotSpeech("speak_trip_briefing_invoke", {
    phrasePreview: phrasePreview(phrase),
    charLength: phrase.length,
  });
  Speech.stop();
  Speech.speak(phrase, speechOptions("briefing", phrase));
}

export function stopAdvisorySpeech(): void {
  logRoadCopilotSpeech("speech_stop", {});
  Speech.stop();
}
