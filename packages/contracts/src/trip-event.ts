/**
 * On-device sensor events and vision-backed lane advisories recorded for a trip.
 * Stored primarily on-device; summarized for family view per privacy choices.
 */
export type TripEventType =
  | "hard_brake"
  | "rapid_acceleration"
  | "sharp_swerve"
  | "lane_drift_advisory"
  | "route_deviation_optional";

export type TripEventSeverity = "low" | "medium" | "high";

export interface TripEvent {
  /** Unique id for deduplication and sync (UUID v4 recommended). */
  id: string;
  tripId: string;
  type: TripEventType;
  /** ISO 8601 timestamp in UTC when the event was detected. */
  occurredAt: string;
  severity: TripEventSeverity;
  /** Optional structured context (e.g. peak deceleration m/s²). */
  metrics?: Record<string, number>;
  /** Human-readable, calm description for logs (not punitive). */
  description?: string;
}
