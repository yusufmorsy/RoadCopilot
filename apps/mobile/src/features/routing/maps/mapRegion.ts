import type { MapCoordinate } from "../decodePolyline";

/** Default span when only one or two points exist. */
const MIN_DELTA = 0.04;

export function regionFromCoordinates(coords: MapCoordinate[]): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} | null {
  if (coords.length === 0) return null;

  let minLat = coords[0].latitude;
  let maxLat = coords[0].latitude;
  let minLng = coords[0].longitude;
  let maxLng = coords[0].longitude;

  for (const c of coords) {
    minLat = Math.min(minLat, c.latitude);
    maxLat = Math.max(maxLat, c.latitude);
    minLng = Math.min(minLng, c.longitude);
    maxLng = Math.max(maxLng, c.longitude);
  }

  const midLat = (minLat + maxLat) / 2;
  const midLng = (minLng + maxLng) / 2;
  const latSpan = Math.max(maxLat - minLat, MIN_DELTA * 0.5);
  const lngSpan = Math.max(maxLng - minLng, MIN_DELTA * 0.5);

  return {
    latitude: midLat,
    longitude: midLng,
    latitudeDelta: Math.max(latSpan * 1.4, MIN_DELTA),
    longitudeDelta: Math.max(lngSpan * 1.4, MIN_DELTA),
  };
}

export function mergeCoordinateLists(lists: MapCoordinate[][]): MapCoordinate[] {
  const out: MapCoordinate[] = [];
  for (const list of lists) {
    for (const c of list) {
      out.push(c);
    }
  }
  return out;
}
