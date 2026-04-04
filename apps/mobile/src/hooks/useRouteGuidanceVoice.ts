import * as Location from "expo-location";
import { useEffect, useRef } from "react";

import {
  logRoadCopilotSpeech,
  phrasePreview,
} from "../debug/speechDiagnostics";
import type { RouteGuidanceStep } from "../features/navigation/types";
import { buildTripBriefingPhrase } from "../features/voice/routeGuidancePhrases";
import {
  speakRoute,
  speakTripBriefing,
  stopAdvisorySpeech,
} from "../features/voice/advisorySpeech";

const APPROACH_END_M = 115;
const DEST_NEAR_M = 95;
/** First turn hint when there is no separate trip briefing. */
const INITIAL_GUIDANCE_DELAY_MS = 900;
/** Trip start ETA line — slightly before first maneuver cue. */
const TRIP_BRIEFING_DELAY_MS = 450;
/** Space after briefing so the first maneuver line does not overlap TTS. */
const FIRST_GUIDANCE_AFTER_BRIEFING_MS = 6200;
const ROUTE_COOLDOWN_MS = 12_000;

function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6_371_000;
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export type UseRouteGuidanceVoiceParams = {
  enabled: boolean;
  /** Resets guidance when the active trip changes (e.g. trip session id). */
  sessionKey: string | null;
  guidanceSteps: RouteGuidanceStep[];
  destinationLatLng: { latitude: number; longitude: number };
  isLaneDrifting: () => boolean;
  /** Trip start cue: "Your trip … should take about X minutes …" */
  destinationLabel?: string;
  durationSecondsEstimate?: number;
};

/**
 * Speaks a trip-start ETA (when known), then advisory route hints. Yields to lane drift TTS.
 */
export function useRouteGuidanceVoice({
  enabled,
  sessionKey,
  guidanceSteps,
  destinationLatLng,
  isLaneDrifting,
  destinationLabel,
  durationSecondsEstimate,
}: UseRouteGuidanceVoiceParams): void {
  const isLaneDriftingRef = useRef(isLaneDrifting);
  isLaneDriftingRef.current = isLaneDrifting;

  const watchEndIndexRef = useRef(0);
  const latchedApproachRef = useRef(false);
  const lastRouteSpeakAtRef = useRef(0);
  const destArrivalSpokenRef = useRef(false);
  const sessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !sessionKey) {
      return;
    }

    const briefing = buildTripBriefingPhrase(
      destinationLabel,
      durationSecondsEstimate
    );
    const hasGuidance = guidanceSteps.length > 0;
    if (!briefing && !hasGuidance) {
      logRoadCopilotSpeech("route_voice_skip_empty", {
        sessionKey,
        reason: "no_briefing_and_no_guidance",
        destinationLabelSet: Boolean(destinationLabel?.trim()),
        durationSecondsEstimate: durationSecondsEstimate ?? null,
        guidanceStepCount: guidanceSteps.length,
      });
      return;
    }

    logRoadCopilotSpeech("route_voice_armed", {
      sessionKey,
      hasBriefing: Boolean(briefing),
      briefingPreview: briefing ? phrasePreview(briefing) : null,
      hasGuidance,
      guidanceStepCount: guidanceSteps.length,
      firstGuidancePreview: hasGuidance
        ? phrasePreview(guidanceSteps[0].announceText)
        : null,
      briefingDelayMs: TRIP_BRIEFING_DELAY_MS,
      firstStepDelayMs: briefing
        ? FIRST_GUIDANCE_AFTER_BRIEFING_MS
        : INITIAL_GUIDANCE_DELAY_MS,
      durationSecondsEstimate: durationSecondsEstimate ?? null,
    });

    if (sessionRef.current !== sessionKey) {
      sessionRef.current = sessionKey;
      watchEndIndexRef.current = 0;
      latchedApproachRef.current = false;
      lastRouteSpeakAtRef.current = 0;
      destArrivalSpokenRef.current = false;
    }

    let cancelled = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let subscription: Location.LocationSubscription | null = null;

    if (briefing) {
      timeouts.push(
        setTimeout(() => {
          if (cancelled) return;
          logRoadCopilotSpeech("route_voice_briefing_timer_fired", {
            delayMs: TRIP_BRIEFING_DELAY_MS,
          });
          speakTripBriefing(briefing);
          lastRouteSpeakAtRef.current = Date.now();
        }, TRIP_BRIEFING_DELAY_MS)
      );
    }

    if (hasGuidance) {
      const firstStepDelay = briefing
        ? FIRST_GUIDANCE_AFTER_BRIEFING_MS
        : INITIAL_GUIDANCE_DELAY_MS;
      timeouts.push(
        setTimeout(() => {
          if (cancelled) return;
          logRoadCopilotSpeech("route_voice_first_step_timer_fired", {
            delayMs: firstStepDelay,
            laneDrifting: isLaneDriftingRef.current(),
          });
          const ok = speakRoute(
            guidanceSteps[0].announceText,
            isLaneDriftingRef.current()
          );
          if (ok) lastRouteSpeakAtRef.current = Date.now();
          else {
            logRoadCopilotSpeech("route_voice_first_step_not_spoken", {
              note: "speakRoute returned false — see speak_route_skipped",
            });
          }
        }, firstStepDelay)
      );

      void (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== "granted") {
          logRoadCopilotSpeech("route_voice_location_denied", {
            status,
            note: "Proximity cues need location; briefing TTS still uses Speech",
          });
          return;
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 3500,
            distanceInterval: 12,
          },
          (loc) => {
            if (cancelled) return;
            const acc = loc.coords.accuracy;
            if (acc != null && acc > 100) return;

            const user = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            };

            const drift = isLaneDriftingRef.current();
            const now = Date.now();

            const wIdx = watchEndIndexRef.current;
            if (wIdx < guidanceSteps.length) {
              const end = guidanceSteps[wIdx].endLatLng;
              const d = haversineMeters(user, end);
              const inside = d < APPROACH_END_M;

              if (!inside) {
                latchedApproachRef.current = false;
              } else if (!latchedApproachRef.current) {
                const nextIdx = wIdx + 1;
                if (nextIdx < guidanceSteps.length) {
                  const since = now - lastRouteSpeakAtRef.current;
                  if (since >= ROUTE_COOLDOWN_MS || wIdx === 0) {
                    if (
                      speakRoute(
                        guidanceSteps[nextIdx].announceText,
                        drift
                      )
                    ) {
                      lastRouteSpeakAtRef.current = now;
                      watchEndIndexRef.current = nextIdx;
                      latchedApproachRef.current = false;
                    }
                  }
                } else {
                  latchedApproachRef.current = true;
                  watchEndIndexRef.current = guidanceSteps.length;
                }
              }
            }

            if (
              watchEndIndexRef.current >= guidanceSteps.length &&
              !destArrivalSpokenRef.current
            ) {
              const dDest = haversineMeters(user, destinationLatLng);
              if (dDest < DEST_NEAR_M) {
                const since = now - lastRouteSpeakAtRef.current;
                if (since >= ROUTE_COOLDOWN_MS) {
                  if (
                    speakRoute(
                      "You are close to your destination. Ease in when it feels safe.",
                      drift
                    )
                  ) {
                    destArrivalSpokenRef.current = true;
                    lastRouteSpeakAtRef.current = now;
                  }
                }
              }
            }
          }
        );
      })();
    }

    return () => {
      cancelled = true;
      for (const t of timeouts) clearTimeout(t);
      subscription?.remove();
      logRoadCopilotSpeech("route_voice_effect_cleanup", { sessionKey });
      stopAdvisorySpeech();
    };
  }, [
    enabled,
    sessionKey,
    guidanceSteps,
    destinationLatLng.latitude,
    destinationLatLng.longitude,
    destinationLabel,
    durationSecondsEstimate,
  ]);
}
