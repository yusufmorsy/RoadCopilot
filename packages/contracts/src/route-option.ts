/**
 * Safe-routing MVP: ranked options presented before the drive.
 * Implementation may use external routing; this is the in-app contract.
 */
export type RouteSafetyLabel = "preferred" | "acceptable" | "use_caution";

export interface RouteOption {
  id: string;
  /** Display name for the driver (short, calm). */
  label: string;
  /** Encoded polyline or ordered coordinates — app and backend must agree on format. */
  geometry: {
    format: "polyline" | "coordinates";
    /** Polyline string or JSON array of [lng, lat] pairs as a string for transport. */
    data: string;
  };
  /** Relative safety ranking; higher is safer per product heuristics. */
  safetyScore: number;
  safetyLabel: RouteSafetyLabel;
  /** Elder-focused, non-alarming rationale (required for MVP safe routing). */
  rationale: string;
  /** Estimated duration in seconds, if known. */
  durationSecondsEstimate?: number;
  /** Estimated distance in meters, if known. */
  distanceMetersEstimate?: number;
}
