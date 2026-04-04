import type { RouteOption, RouteSafetyLabel } from "@roadcopilot/contracts";
import type { LatLng, ParsedGoogleRoute } from "../../services/googleRoutesClient";
import {
  buildFastestRationale,
  buildSaferRationale,
  routesLookLikeSamePath,
  safetyScoreFromHeuristics,
  summarizeRouteHeuristics,
} from "./safeRouteHeuristics";

/** Distinct placeholder polylines so comparison treats them as different paths (demo only). */
const DEMO_POLYLINE_FAST = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
const DEMO_POLYLINE_SAFER = "_ekiF~py|U_ukLnnqC_mqNvxq`@";

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
 */
export function buildMockRouteOptions(destinationLabel: string, _destination: LatLng): RouteOption[] {
  const fastestParsed = toParsedFromSynthetic({
    distanceMeters: 18200,
    durationSeconds: 22 * 60,
    leftTurns: 5,
    steps: 32,
    avoidHighways: false,
    encodedPolyline: DEMO_POLYLINE_FAST,
    mergeAt: [3, 18],
    roundaboutAt: [11],
  });
  const saferParsed = toParsedFromSynthetic({
    distanceMeters: 19600,
    durationSeconds: 26 * 60,
    leftTurns: 2,
    steps: 26,
    avoidHighways: true,
    encodedPolyline: DEMO_POLYLINE_SAFER,
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
