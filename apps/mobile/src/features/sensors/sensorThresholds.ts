/**
 * Central tuning knobs for on-device motion detection.
 * Adjust here only — hooks read these constants.
 */
export const SENSOR_SAMPLING_MS = 100;

/** Low-pass on raw accelerometer to estimate gravity (higher = smoother baseline). */
export const GRAVITY_EMA_ALPHA = 0.92;

/** Minimum linear-acceleration jerk (m/s² delta between samples) to consider. */
export const HARD_BRAKE_LINEAR_JERK_MIN = 2.8;
export const RAPID_ACCEL_LINEAR_JERK_MIN = 2.6;

/**
 * Change in |linear acc| between samples (m/s²) — helps split brake vs accel heuristically.
 * Phone orientation varies; tune with real drives.
 */
export const BRAKE_LIN_MAG_DROP_MIN = 0.35;
export const ACCEL_LIN_MAG_RISE_MIN = 0.35;

/** Gyroscope magnitude (rad/s) — rotation-heavy maneuver (e.g. sharp turn). */
export const SHARP_SWERVE_GYRO_MAG_MIN = 2.0;

/** Optional: dominant yaw (Z) must exceed this if total mag is borderline (rad/s). */
export const SHARP_SWERVE_GYRO_Z_MIN = 1.2;

/** Cooldown between events of the same type (ms) to reduce duplicate firings. */
export const EVENT_COOLDOWN_MS: Record<
  "hard_brake" | "rapid_acceleration" | "sharp_swerve",
  number
> = {
  hard_brake: 4500,
  rapid_acceleration: 4500,
  sharp_swerve: 3500,
};

/** If brake and accel both qualify, prefer the stronger signal by this hysteresis ratio. */
export const BRAKE_VS_ACCEL_PRIORITY_RATIO = 1.08;
