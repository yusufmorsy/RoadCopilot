import type { TripEvent } from "@roadcopilot/contracts";
import { Accelerometer, Gyroscope } from "expo-sensors";
import { useEffect, useRef } from "react";
import {
  detectLongitudinalManeuver,
  detectSharpSwerve,
  type GyroSample,
  type MotionDetectorState,
  type AccSample,
  updateGravityEma,
} from "./motionDetection";
import { newTripEventId } from "./newTripEventId";
import {
  EVENT_COOLDOWN_MS,
  GRAVITY_EMA_ALPHA,
  SENSOR_SAMPLING_MS,
} from "./sensorThresholds";

export interface UseMotionSensorLoopParams {
  isActive: boolean;
  tripId: string | null;
  onTripEvent: (event: TripEvent) => void;
}

function nowMs(): number {
  return Date.now();
}

export function useMotionSensorLoop({
  isActive,
  tripId,
  onTripEvent,
}: UseMotionSensorLoopParams): void {
  const onTripEventRef = useRef(onTripEvent);
  onTripEventRef.current = onTripEvent;

  const motionStateRef = useRef<MotionDetectorState>({
    gravityEma: { x: 0, y: 0, z: 0 },
    prevLinear: null,
    initialized: false,
  });

  const lastGyroRef = useRef<GyroSample | null>(null);
  const cooldownRef = useRef<Partial<Record<string, number>>>({});

  useEffect(() => {
    if (!isActive || !tripId) {
      motionStateRef.current = {
        gravityEma: { x: 0, y: 0, z: 0 },
        prevLinear: null,
        initialized: false,
      };
      lastGyroRef.current = null;
      cooldownRef.current = {};
      return;
    }

    motionStateRef.current = {
      gravityEma: { x: 0, y: 0, z: 0 },
      prevLinear: null,
      initialized: false,
    };
    lastGyroRef.current = null;
    cooldownRef.current = {};

    Accelerometer.setUpdateInterval(SENSOR_SAMPLING_MS);
    Gyroscope.setUpdateInterval(SENSOR_SAMPLING_MS);

    const accSub = Accelerometer.addListener((data) => {
      const t = nowMs();
      const raw: AccSample = { x: data.x, y: data.y, z: data.z, t };
      const linear = updateGravityEma(
        motionStateRef.current,
        raw,
        GRAVITY_EMA_ALPHA
      );
      const detected = detectLongitudinalManeuver(motionStateRef.current, linear);
      if (!detected) return;
      const key = detected.type;
      const last = cooldownRef.current[key] ?? 0;
      if (t - last < EVENT_COOLDOWN_MS[key]) return;
      cooldownRef.current[key] = t;

      const event: TripEvent = {
        id: newTripEventId(),
        tripId,
        type: detected.type,
        occurredAt: new Date().toISOString(),
        severity: detected.severity,
        metrics: detected.metrics,
        description: detected.description,
      };
      onTripEventRef.current(event);
    });

    const gyroSub = Gyroscope.addListener((data) => {
      const t = nowMs();
      const sample: GyroSample = { x: data.x, y: data.y, z: data.z, t };
      lastGyroRef.current = sample;
      const detected = detectSharpSwerve(sample);
      if (!detected) return;
      const key = detected.type;
      const last = cooldownRef.current[key] ?? 0;
      if (t - last < EVENT_COOLDOWN_MS.sharp_swerve) return;
      cooldownRef.current[key] = t;

      const event: TripEvent = {
        id: newTripEventId(),
        tripId,
        type: detected.type,
        occurredAt: new Date().toISOString(),
        severity: detected.severity,
        metrics: detected.metrics,
        description: detected.description,
      };
      onTripEventRef.current(event);
    });

    return () => {
      accSub.remove();
      gyroSub.remove();
    };
  }, [isActive, tripId]);
}
