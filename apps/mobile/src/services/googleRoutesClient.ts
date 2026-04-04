/**
 * Google Maps Platform — Routes API (v2) + Geocoding REST.
 * Provider is explicit; do not swap without product review.
 *
 * Set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` for live calls. When missing, callers
 * should use mock route data (see `features/routing/mockRoutes.ts`).
 */

const ROUTES_BASE = "https://routes.googleapis.com/directions/v2:computeRoutes";
const GEOCODE_BASE = "https://maps.googleapis.com/maps/api/geocode/json";

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface GoogleRoutesClientConfig {
  apiKey: string;
}

export type ParsedRouteStep = {
  distanceMeters?: number;
  maneuver?: string;
};

/** Internal shape for heuristic scoring — not a contracts duplicate. */
export type ParsedGoogleRoute = {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  steps: ParsedRouteStep[];
  /** True when this route was requested with avoidHighways. */
  requestedAvoidHighways: boolean;
};

function parseDurationSeconds(duration: unknown): number {
  if (duration == null) return 0;
  if (typeof duration === "string") {
    const m = duration.match(/^(\d+)s$/);
    if (m) return Number(m[1]);
    const n = Number(duration.replace(/s$/, ""));
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof duration === "object" && duration !== null && "seconds" in duration) {
    const s = (duration as { seconds?: string | number }).seconds;
    return typeof s === "string" ? Number(s) || 0 : typeof s === "number" ? s : 0;
  }
  return 0;
}

function waypointFromLatLng(latLng: LatLng) {
  return { location: { latLng: { latitude: latLng.latitude, longitude: latLng.longitude } } };
}

async function postComputeRoutes(
  apiKey: string,
  body: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(ROUTES_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.distanceMeters,routes.legs.steps.navigationInstruction",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { error?: { message?: string }; routes?: unknown[] };
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `Routes API error (${res.status})`);
  }
  return json;
}

function parseRouteFromResponse(
  route: Record<string, unknown>,
  requestedAvoidHighways: boolean
): ParsedGoogleRoute | null {
  const distanceMeters = Number(route.distanceMeters) || 0;
  const durationSeconds = parseDurationSeconds(route.duration);
  const poly = route.polyline as { encodedPolyline?: string } | undefined;
  const encodedPolyline = poly?.encodedPolyline ?? "";
  if (!encodedPolyline) return null;

  const legs = (route.legs as Record<string, unknown>[] | undefined) ?? [];
  const steps: ParsedRouteStep[] = [];
  for (const leg of legs) {
    const legSteps = (leg.steps as Record<string, unknown>[] | undefined) ?? [];
    for (const step of legSteps) {
      const ni = step.navigationInstruction as { maneuver?: string } | undefined;
      steps.push({
        distanceMeters: typeof step.distanceMeters === "number" ? step.distanceMeters : undefined,
        maneuver: ni?.maneuver,
      });
    }
  }

  return {
    distanceMeters,
    durationSeconds,
    encodedPolyline,
    steps,
    requestedAvoidHighways,
  };
}

export { getGoogleMapsApiKeyFromEnv } from "../config/expoPublicEnv";

export async function geocodeAddress(
  apiKey: string,
  address: string
): Promise<{ latLng: LatLng; formattedAddress: string }> {
  const url = `${GEOCODE_BASE}?address=${encodeURIComponent(address.trim())}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    error_message?: string;
    results?: { geometry: { location: { lat: number; lng: number } }; formatted_address: string }[];
  };
  if (data.status !== "OK" || !data.results?.[0]) {
    throw new Error(data.error_message ?? `Geocoding failed (${data.status})`);
  }
  const r = data.results[0];
  return {
    latLng: { latitude: r.geometry.location.lat, longitude: r.geometry.location.lng },
    formattedAddress: r.formatted_address,
  };
}

export async function computeDriveRoute(
  apiKey: string,
  origin: LatLng,
  destination: LatLng,
  options: { avoidHighways: boolean }
): Promise<ParsedGoogleRoute | null> {
  const body: Record<string, unknown> = {
    origin: waypointFromLatLng(origin),
    destination: waypointFromLatLng(destination),
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    computeAlternativeRoutes: false,
    routeModifiers: {
      avoidHighways: options.avoidHighways,
      avoidTolls: false,
      avoidFerries: false,
    },
    languageCode: "en-US",
    units: "IMPERIAL",
  };

  const json = (await postComputeRoutes(apiKey, body)) as { routes?: Record<string, unknown>[] };
  const first = json.routes?.[0];
  if (!first) return null;
  return parseRouteFromResponse(first, options.avoidHighways);
}
