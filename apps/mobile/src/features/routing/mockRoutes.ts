import type { RouteOption, RouteSafetyLabel } from "@roadcopilot/contracts";
import type { LatLng, ParsedGoogleRoute } from "../../services/googleRoutesClient";
import {
  buildFastestRationale,
  buildSaferRationale,
  routesLookLikeSamePath,
  safetyScoreFromHeuristics,
  summarizeRouteHeuristics,
} from "./safeRouteHeuristics";

/** Short valid-style polyline placeholder (not a real road — demo only). */
const DEMO_POLYLINE =
  "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

function toParsedFromSynthetic(params: {
  distanceMeters: number;
  durationSeconds: number;
  leftTurns: number;
  steps: number;
  avoidHighways: boolean;
}): ParsedGoogleRoute {
  const steps = [];
  for (let i = 0; i < params.steps; i += 1) {
    let maneuver: string | undefined;
    if (i < params.leftTurns) maneuver = "TURN_LEFT";
    else if (i % 4 === 0) maneuver = "TURN_RIGHT";
    else maneuver = "STRAIGHT";
    steps.push({ distanceMeters: Math.floor(params.distanceMeters / params.steps), maneuver });
  }
  return {
    distanceMeters: params.distanceMeters,
    durationSeconds: params.durationSeconds,
    encodedPolyline: DEMO_POLYLINE,
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
  });
  const saferParsed = toParsedFromSynthetic({
    distanceMeters: 19600,
    durationSeconds: 26 * 60,
    leftTurns: 2,
    steps: 38,
    avoidHighways: true,
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
