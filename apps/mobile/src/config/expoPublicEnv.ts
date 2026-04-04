/**
 * Expo inlines `EXPO_PUBLIC_*` at bundle time from `apps/mobile/.env`.
 * Copy `.env.example` → `.env` and fill values (`.env` is gitignored).
 */

export type PlanFallbackOrigin = {
  latitude: number;
  longitude: number;
};

function readTrimmed(name: string): string | undefined {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}

export function getGoogleMapsApiKeyFromEnv(): string | undefined {
  return readTrimmed("EXPO_PUBLIC_GOOGLE_MAPS_API_KEY");
}

/** Optional override; otherwise the Maps key above is used for Roads when wired. */
export function getGoogleRoadsApiKeyFromEnv(): string | undefined {
  return (
    readTrimmed("EXPO_PUBLIC_GOOGLE_ROADS_API_KEY") ?? getGoogleMapsApiKeyFromEnv()
  );
}

export function getVisionApiBaseUrl(): string | undefined {
  const raw = readTrimmed("EXPO_PUBLIC_VISION_API_URL");
  return raw ? raw.replace(/\/+$/, "") : undefined;
}

export function isVisionApiConfigured(): boolean {
  return getVisionApiBaseUrl() !== undefined;
}

/**
 * Origin used for route planning when location permission is not granted.
 * Set both lat and lng in `.env` (decimal degrees).
 */
export function getPlanFallbackOrigin(): PlanFallbackOrigin | null {
  const latS = readTrimmed("EXPO_PUBLIC_FALLBACK_ORIGIN_LAT");
  const lngS = readTrimmed("EXPO_PUBLIC_FALLBACK_ORIGIN_LNG");
  if (!latS || !lngS) return null;
  const latitude = Number(latS);
  const longitude = Number(lngS);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return null;
  }
  return { latitude, longitude };
}
