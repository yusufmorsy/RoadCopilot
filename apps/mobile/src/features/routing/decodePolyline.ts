import type { RouteOption } from "@roadcopilot/contracts";

/** Coordinates for `react-native-maps` `Polyline` / `fitToCoordinates`. */
export type MapCoordinate = { latitude: number; longitude: number };

/**
 * Decodes a Google-encoded polyline string into latitude/longitude points.
 * @see https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
/** Encodes a single signed delta for Google's polyline format (scaled ×1e5 integers). */
function encodeSignedDelta(delta: number): string {
  let v = delta < 0 ? ~(delta << 1) : delta << 1;
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  out += String.fromCharCode(v + 63);
  return out;
}

/** Encodes latitude/longitude points as a Google-encoded polyline string. */
export function encodePolyline(points: MapCoordinate[]): string {
  if (!points.length) return "";
  let prevLatE5 = 0;
  let prevLngE5 = 0;
  let encoded = "";
  for (const p of points) {
    const latE5 = Math.round(p.latitude * 1e5);
    const lngE5 = Math.round(p.longitude * 1e5);
    const dLat = latE5 - prevLatE5;
    const dLng = lngE5 - prevLngE5;
    prevLatE5 = latE5;
    prevLngE5 = lngE5;
    encoded += encodeSignedDelta(dLat);
    encoded += encodeSignedDelta(dLng);
  }
  return encoded;
}

export function decodePolyline(encoded: string): MapCoordinate[] {
  if (!encoded || typeof encoded !== "string") return [];

  const coordinates: MapCoordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return coordinates;
}

function parseCoordinatesJson(data: string): MapCoordinate[] | null {
  try {
    const raw = JSON.parse(data) as unknown;
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const out: MapCoordinate[] = [];
    for (const pair of raw) {
      if (!Array.isArray(pair) || pair.length < 2) return null;
      const lng = Number(pair[0]);
      const lat = Number(pair[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      out.push({ latitude: lat, longitude: lng });
    }
    return out;
  } catch {
    return null;
  }
}

/** Decodes a {@link RouteOption} geometry field into map coordinates. */
export function coordinatesFromRouteOption(option: RouteOption): MapCoordinate[] {
  const { format, data } = option.geometry;
  if (!data?.trim()) return [];

  if (format === "coordinates") {
    return parseCoordinatesJson(data) ?? [];
  }

  return decodePolyline(data);
}
