import * as Speech from "expo-speech";
import { useEffect, useRef } from "react";

import type { LaneDisplayStatus } from "../features/vision/laneStatus";
import {
  LANE_ALERT_DRIFT_LEFT,
  LANE_ALERT_DRIFT_RIGHT,
} from "../features/voice/laneAlertPhrases";

const CONSECUTIVE_SAMPLES = 2;
const SAME_PHRASE_COOLDOWN_MS = 10_000;
const CROSS_PHRASE_COOLDOWN_MS = 5_000;

/**
 * Speaks short drift cues only on sustained drift, with cooldowns to avoid spam.
 * One-way TTS only — not a conversational assistant.
 */
export function useLaneAlerts(
  status: LaneDisplayStatus,
  enabled: boolean
): void {
  const streakDirRef = useRef<LaneDisplayStatus | null>(null);
  const streakCountRef = useRef(0);
  const lastPhraseRef = useRef<string | null>(null);
  const lastSpokenAtRef = useRef(0);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      Speech.stop();
      streakDirRef.current = null;
      streakCountRef.current = 0;
      return;
    }

    if (status !== "drifting_left" && status !== "drifting_right") {
      streakDirRef.current = null;
      streakCountRef.current = 0;
      return;
    }

    if (streakDirRef.current !== status) {
      streakDirRef.current = status;
      streakCountRef.current = 1;
      return;
    }

    streakCountRef.current += 1;
    if (streakCountRef.current < CONSECUTIVE_SAMPLES) return;

    const phrase =
      status === "drifting_left"
        ? LANE_ALERT_DRIFT_LEFT
        : LANE_ALERT_DRIFT_RIGHT;

    const now = Date.now();
    const sinceLast = now - lastSpokenAtRef.current;

    if (phrase === lastPhraseRef.current && sinceLast < SAME_PHRASE_COOLDOWN_MS) {
      return;
    }
    if (phrase !== lastPhraseRef.current && sinceLast < CROSS_PHRASE_COOLDOWN_MS) {
      return;
    }

    Speech.stop();
    Speech.speak(phrase, {
      rate: 0.92,
      pitch: 1,
    });
    lastPhraseRef.current = phrase;
    lastSpokenAtRef.current = now;
  }, [status, enabled]);
}
