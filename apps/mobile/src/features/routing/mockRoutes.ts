import type { RouteOption, RouteSafetyLabel } from "@roadcopilot/contracts";
import type { LatLng, ParsedGoogleRoute } from "../../services/googleRoutesClient";
import { encodePolyline } from "./decodePolyline";
import {
  buildFastestRationale,
  buildSaferRationale,
  routesLookLikeSamePath,
  safetyScoreFromHeuristics,
  summarizeRouteHeuristics,
} from "./safeRouteHeuristics";

/** Slight detour so safer mock path differs from straight-line fastest in previews. */
function mockSaferMidpoint(origin: LatLng, destination: LatLng): LatLng {
  return {
    latitude: (origin.latitude + destination.latitude) / 2 + 0.006,
    longitude: (origin.longitude + destination.longitude) / 2 - 0.004,
  };
}

function toParsedFromSynthetic(params: {
  distanceMeters: number;
  durationSeconds: number;
  leftTurns: number;
  steps: number;
  avoidHighways: boolean;
  encodedPolyline: string;
  mergeAt?: number[];
  roundaboutAt?: number[];
}): ParsedGoogleRoute {
  const mergeSet = new Set(params.mergeAt ?? []);
  const roundaboutSet = new Set(params.roundaboutAt ?? []);
  const steps = [];
  for (let i = 0; i < params.steps; i += 1) {
    let maneuver: string | undefined;
    if (mergeSet.has(i)) maneuver = "MERGE";
    else if (roundaboutSet.has(i)) maneuver = "ROUNDABOUT_LEFT";
    else if (i < params.leftTurns) maneuver = "TURN_LEFT";
    else if (i % 5 === 0) maneuver = "TURN_RIGHT";
    else maneuver = "STRAIGHT";
    steps.push({ distanceMeters: Math.floor(params.distanceMeters / params.steps), maneuver });
  }
  return {
    distanceMeters: params.distanceMeters,
    durationSeconds: params.durationSeconds,
    encodedPolyline: params.encodedPolyline,
    steps,
    requestedAvoidHighways: params.avoidHighways,
  };
}

function toRouteOption(
  id: string,
  label: string,
  parsed: ParsedGoogleRoute,
  rationale: string,
  safetyLabel: RouteSafetyLabel
): RouteOption {
  const h = summarizeRouteHeuristics(parsed);
  return {
    id,
    label,
    geometry: { format: "polyline", data: parsed.encodedPolyline },
    safetyScore: safetyScoreFromHeuristics(h),
    safetyLabel,
    rationale,
    durationSecondsEstimate: parsed.durationSeconds,
    distanceMetersEstimate: parsed.distanceMeters,
  };
}

/**
 * Offline / no-key demo: believable Fastest vs Safer with visible reasoning.
 * Geometry is encoded from `origin` → `destination` so the map matches the markers (no fixed demo path).
 */
export function buildMockRouteOptions(
  destinationLabel: string,
  origin: LatLng,
  destination: LatLng
): RouteOption[] {
  const mid = mockSaferMidpoint(origin, destination);
  const polyFast = encodePolyline([
    { latitude: origin.latitude, longitude: origin.longitude },
    { latitude: destination.latitude, longitude: destination.longitude },
  ]);
  const polySafer = encodePolyline([
    { latitude: origin.latitude, longitude: origin.longitude },
    { latitude: mid.latitude, longitude: mid.longitude },
    { latitude: destination.latitude, longitude: destination.longitude },
  ]);

  const fastestParsed = toParsedFromSynthetic({
    distanceMeters: 18200,
    durationSeconds: 22 * 60,
    leftTurns: 5,
    steps: 32,
    avoidHighways: false,
    encodedPolyline: polyFast,
    mergeAt: [3, 18],
    roundaboutAt: [11],
  });
  const saferParsed = toParsedFromSynthetic({
    distanceMeters: 19600,
    durationSeconds: 26 * 60,
    leftTurns: 2,
    steps: 26,
    avoidHighways: true,
    encodedPolyline: polySafer,
  });

  const fastH = summarizeRouteHeuristics(fastestParsed);
  const safeH = summarizeRouteHeuristics(saferParsed);
  const samePath = routesLookLikeSamePath(fastestParsed, saferParsed);

  return [
    toRouteOption(
      "fastest",
      "Fastest Route",
      fastestParsed,
      buildFastestRationale(fastH),
      "acceptable"
    ),
    toRouteOption(
      "safer",
      "Safer Route",
      saferParsed,
      buildSaferRationale(safeH, fastH, samePath),
      "preferred"
    ),
  ];
}
