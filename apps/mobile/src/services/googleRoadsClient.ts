/**
 * Google Maps Platform — Roads API (speed limits / snap-to-road).
 * Use this for future advisory speed-limit checks along a driven path.
 *
 * Full flow (later):
 * 1. Sample or snap GPS trace with `snapToRoads` (or equivalent REST).
 * 2. Call speed limits for `placeId`s returned along the path.
 * 3. Compare to GPS speed for gentle in-cab hints (advisory only).
 *
 * This module exposes a small interface so navigation code does not embed
 * Roads URLs. Implementations stay Google-only unless product changes provider.
 */

import type { LatLng } from "./googleRoutesClient";

export type SpeedLimitSegment = {
  /** Place identifier from Roads when available. */
  placeId?: string;
  /** Posted limit in km/h when the API returns it. */
  speedLimitKph?: number;
};

export type SpeedLimitsAlongRouteResult = {
  segments: SpeedLimitSegment[];
  /** Helps demos/logs know data is not live. */
  source: "google-roads" | "stub";
};

export interface GoogleRoadsClient {
  fetchSpeedLimitsAlongRoute(path: LatLng[]): Promise<SpeedLimitsAlongRouteResult>;
}

export function getGoogleRoadsApiKeyFromEnv(): string | undefined {
  // Same key often works for Roads; allow override if you split keys later.
  const k =
    process.env.EXPO_PUBLIC_GOOGLE_ROADS_API_KEY ?? process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  return typeof k === "string" && k.trim().length > 0 ? k.trim() : undefined;
}

/**
 * Stub: returns empty segments. Replace body with Roads REST calls when ready.
 * Typical endpoint family: `https://roads.googleapis.com/v1/speedLimits` (POST with place IDs).
 */
export function createStubGoogleRoadsClient(): GoogleRoadsClient {
  return {
    async fetchSpeedLimitsAlongRoute() {
      return { segments: [], source: "stub" };
    },
  };
}
