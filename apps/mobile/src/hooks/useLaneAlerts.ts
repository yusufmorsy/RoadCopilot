import { useEffect, useRef } from "react";

import { speakLane, stopAdvisorySpeech } from "../features/voice/advisorySpeech";
import type { LaneDisplayStatus } from "../features/vision/laneStatus";
import {
  LANE_ALERT_DRIFT_LEFT,
  LANE_ALERT_DRIFT_RIGHT,
} from "../features/voice/laneAlertPhrases";

const CONSECUTIVE_SAMPLES = 2;
const SAME_PHRASE_COOLDOWN_MS = 10_000;
const CROSS_PHRASE_COOLDOWN_MS = 5_000;

export type UseLaneAlertsOptions = {
  /** Fired when a drift advisory is about to be spoken (same gating as TTS). */
  onDriftAdvisory?: (direction: "left" | "right") => void;
};

/**
 * Speaks short drift cues only on sustained drift, with cooldowns to avoid spam.
 * One-way TTS only — not a conversational assistant.
 */
export function useLaneAlerts(
  status: LaneDisplayStatus,
  enabled: boolean,
  options?: UseLaneAlertsOptions
): void {
  const streakDirRef = useRef<LaneDisplayStatus | null>(null);
  const streakCountRef = useRef(0);
  const lastPhraseRef = useRef<string | null>(null);
  const lastSpokenAtRef = useRef(0);
  const onDriftAdvisoryRef = useRef(options?.onDriftAdvisory);
  onDriftAdvisoryRef.current = options?.onDriftAdvisory;

  useEffect(() => {
    return () => {
      stopAdvisorySpeech();
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      stopAdvisorySpeech();
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

    const direction: "left" | "right" =
      status === "drifting_left" ? "left" : "right";
    onDriftAdvisoryRef.current?.(direction);

    speakLane(phrase);
    lastPhraseRef.current = phrase;
    lastSpokenAtRef.current = now;
  }, [status, enabled]);
}
