import type { TripEventSeverity, TripEventType } from "@roadcopilot/contracts";
import {
  ACCEL_LIN_MAG_RISE_MIN,
  BRAKE_LIN_MAG_DROP_MIN,
  BRAKE_VS_ACCEL_PRIORITY_RATIO,
  HARD_BRAKE_LINEAR_JERK_MIN,
  RAPID_ACCEL_LINEAR_JERK_MIN,
  SHARP_SWERVE_GYRO_MAG_MIN,
  SHARP_SWERVE_GYRO_Z_MIN,
} from "./sensorThresholds";

export interface AccSample {
  x: number;
  y: number;
  z: number;
  t: number;
}

export interface GyroSample {
  x: number;
  y: number;
  z: number;
  t: number;
}

export interface GravityEmaState {
  x: number;
  y: number;
  z: number;
}

export interface LinearAccState {
  x: number;
  y: number;
  z: number;
  magnitude: number;
}

export interface MotionDetectorState {
  gravityEma: GravityEmaState;
  prevLinear: LinearAccState | null;
  initialized: boolean;
}

export interface DetectedMotion {
  type: TripEventType;
  severity: TripEventSeverity;
  metrics: Record<string, number>;
  description: string;
}

function hypot3(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

function severityFromRatio(actual: number, threshold: number): TripEventSeverity {
  const r = actual / threshold;
  if (r >= 1.65) return "high";
  if (r >= 1.25) return "medium";
  return "low";
}

/**
 * Updates gravity EMA and returns linear acceleration (raw − estimated gravity).
 */
export function updateGravityEma(
  state: MotionDetectorState,
  raw: AccSample,
  alpha: number
): LinearAccState {
  if (!state.initialized) {
    state.gravityEma = { x: raw.x, y: raw.y, z: raw.z };
    state.initialized = true;
  } else {
    const g = state.gravityEma;
    g.x = alpha * g.x + (1 - alpha) * raw.x;
    g.y = alpha * g.y + (1 - alpha) * raw.y;
    g.z = alpha * g.z + (1 - alpha) * raw.z;
  }
  const lx = raw.x - state.gravityEma.x;
  const ly = raw.y - state.gravityEma.y;
  const lz = raw.z - state.gravityEma.z;
  return { x: lx, y: ly, z: lz, magnitude: hypot3(lx, ly, lz) };
}

export function detectLongitudinalManeuver(
  state: MotionDetectorState,
  linearNow: LinearAccState
): DetectedMotion | null {
  const prev = state.prevLinear;
  state.prevLinear = { ...linearNow };

  if (!prev) return null;

  const dlx = linearNow.x - prev.x;
  const dly = linearNow.y - prev.y;
  const dlz = linearNow.z - prev.z;
  const jerk = hypot3(dlx, dly, dlz);
  const dMag = linearNow.magnitude - prev.magnitude;

  const brakeCandidate =
    jerk >= HARD_BRAKE_LINEAR_JERK_MIN && dMag <= -BRAKE_LIN_MAG_DROP_MIN;
  const accelCandidate =
    jerk >= RAPID_ACCEL_LINEAR_JERK_MIN && dMag >= ACCEL_LIN_MAG_RISE_MIN;

  if (brakeCandidate && accelCandidate) {
    if (jerk >= HARD_BRAKE_LINEAR_JERK_MIN * BRAKE_VS_ACCEL_PRIORITY_RATIO) {
      return buildBrake(jerk, dMag, linearNow.magnitude);
    }
    if (jerk >= RAPID_ACCEL_LINEAR_JERK_MIN * BRAKE_VS_ACCEL_PRIORITY_RATIO) {
      return buildAccel(jerk, dMag, linearNow.magnitude);
    }
    return dMag < 0 ? buildBrake(jerk, dMag, linearNow.magnitude) : buildAccel(jerk, dMag, linearNow.magnitude);
  }
  if (brakeCandidate) return buildBrake(jerk, dMag, linearNow.magnitude);
  if (accelCandidate) return buildAccel(jerk, dMag, linearNow.magnitude);
  return null;
}

function buildBrake(
  jerk: number,
  dMag: number,
  linMag: number
): DetectedMotion {
  const severity = severityFromRatio(jerk, HARD_BRAKE_LINEAR_JERK_MIN);
  return {
    type: "hard_brake",
    severity,
    metrics: { linearJerk: jerk, linearMagDelta: dMag, linearMag: linMag },
    description: "A firmer slowdown was sensed — worth a gentle check-in if it felt sudden.",
  };
}

function buildAccel(
  jerk: number,
  dMag: number,
  linMag: number
): DetectedMotion {
  const severity = severityFromRatio(jerk, RAPID_ACCEL_LINEAR_JERK_MIN);
  return {
    type: "rapid_acceleration",
    severity,
    metrics: { linearJerk: jerk, linearMagDelta: dMag, linearMag: linMag },
    description: "A quicker increase in motion was noted — supportive awareness only.",
  };
}

export function detectSharpSwerve(gyro: GyroSample): DetectedMotion | null {
  const mag = hypot3(gyro.x, gyro.y, gyro.z);
  const yawish = Math.abs(gyro.z);
  if (mag < SHARP_SWERVE_GYRO_MAG_MIN && yawish < SHARP_SWERVE_GYRO_Z_MIN) {
    return null;
  }
  const severity = severityFromRatio(
    Math.max(mag, yawish),
    SHARP_SWERVE_GYRO_MAG_MIN
  );
  return {
    type: "sharp_swerve",
    severity,
    metrics: { gyroMagnitude: mag, gyroZAbs: yawish },
    description: "A sharper direction change showed up on the sensors — often near turns.",
  };
}
