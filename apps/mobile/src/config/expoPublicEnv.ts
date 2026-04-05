/**
 * Expo replaces `process.env.EXPO_PUBLIC_*` when the **JavaScript bundle** is produced.
 *
 * - **`npx expo start` (Expo Go / dev client + Metro):** reads `apps/mobile/.env` automatically.
 * - **EAS Update or an install that does not use your Metro server:** the bundle was built on EAS
 *   (or embedded at build time) — add the same variables under Project → Environment variables on
 *   expo.dev, then run `eas update` or `eas build` again. A local `.env` on your laptop is not
 *   sent to EAS servers.
 *
 * Copy `.env.example` → `.env` for local development (`.env` is gitignored).
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
  if (!raw) return undefined;
  let u = raw.replace(/\/+$/, "");
  // Common mistake: pasting the full endpoint; mobile app appends /analyze-frame.
  u = u.replace(/\/analyze-frame\/?$/i, "");
  return u;
}

export function isVisionApiConfigured(): boolean {
  return getVisionApiBaseUrl() !== undefined;
}

/**
 * Max time to wait for POST /analyze-frame (upload + response). Lower = faster failure when the
 * server is unreachable; raise on slow networks via EXPO_PUBLIC_VISION_ANALYZE_TIMEOUT_MS.
 */
export function getVisionAnalyzeTimeoutMs(): number {
  const raw = readTrimmed("EXPO_PUBLIC_VISION_ANALYZE_TIMEOUT_MS");
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n)) {
      return Math.min(120_000, Math.max(8_000, Math.round(n)));
    }
  }
  return 18_000;
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
