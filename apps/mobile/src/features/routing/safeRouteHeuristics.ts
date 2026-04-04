import type { ParsedGoogleRoute } from "../../services/googleRoutesClient";

const STRONG_LEFT = new Set([
  "TURN_LEFT",
  "TURN_SHARP_LEFT",
  "SLIGHT_LEFT",
  "TURN_SLIGHT_LEFT",
  "U_TURN_LEFT",
  "U_TURN_RIGHT",
  "U_TURN",
]);

const RIGHT_TURNS = new Set([
  "TURN_RIGHT",
  "TURN_SHARP_RIGHT",
  "SLIGHT_RIGHT",
  "TURN_SLIGHT_RIGHT",
]);

export type RouteHeuristicSummary = {
  leftTurnCount: number;
  rightTurnCount: number;
  stepCount: number;
  impliedAverageKmh: number;
  requestedAvoidHighways: boolean;
};

export function summarizeRouteHeuristics(route: ParsedGoogleRoute): RouteHeuristicSummary {
  let leftTurnCount = 0;
  let rightTurnCount = 0;
  for (const step of route.steps) {
    const m = step.maneuver;
    if (m && STRONG_LEFT.has(m)) leftTurnCount += 1;
    if (m && RIGHT_TURNS.has(m)) rightTurnCount += 1;
  }
  const hours = route.durationSeconds > 0 ? route.durationSeconds / 3600 : 0;
  const km = route.distanceMeters / 1000;
  const impliedAverageKmh = hours > 0 ? km / hours : 0;
  return {
    leftTurnCount,
    rightTurnCount,
    stepCount: route.steps.length,
    impliedAverageKmh,
    requestedAvoidHighways: route.requestedAvoidHighways,
  };
}

/** Higher is better (safer / calmer proxy). */
export function safetyScoreFromHeuristics(h: RouteHeuristicSummary): number {
  let score = 72;
  score -= Math.min(h.leftTurnCount * 4, 28);
  score -= h.impliedAverageKmh > 85 ? 12 : h.impliedAverageKmh > 70 ? 6 : 0;
  if (h.requestedAvoidHighways) score += 10;
  score -= Math.min(Math.max(0, h.stepCount - 25) * 0.15, 8);
  return Math.round(Math.max(15, Math.min(98, score)));
}

function plainLeftTurnPhrase(left: number, comparedTo?: number): string {
  if (comparedTo === undefined) {
    if (left === 0) return "no counted left turns in the step list";
    if (left === 1) return "only one counted left turn in the step list";
    return `${left} counted left turns in the step list`;
  }
  if (left < comparedTo) return `fewer counted left turns than the fastest option (${left} vs ${comparedTo})`;
  if (left === comparedTo) return `about the same number of left turns as the fastest option`;
  return `more counted left turns than the fastest option (${left} vs ${comparedTo})`;
}

export function buildFastestRationale(fast: RouteHeuristicSummary): string {
  const parts: string[] = [
    `Gets you there in the shortest time we found (${plainLeftTurnPhrase(fast.leftTurnCount)}).`,
  ];
  if (fast.impliedAverageKmh > 80) {
    parts.push("It may use faster roads, including highways when they help.");
  }
  parts.push("Fine when you are comfortable with that pace.");
  return parts.join(" ");
}

export function buildSaferRationale(
  safer: RouteHeuristicSummary,
  fastest: RouteHeuristicSummary,
  samePath: boolean
): string {
  if (samePath) {
    return "For this trip, the calmer-style choice matches the fastest path — a straightforward drive with no separate slower option from the map data.";
  }
  const bits: string[] = [
    "Safer Route favors calmer driving: ",
    plainLeftTurnPhrase(safer.leftTurnCount, fastest.leftTurnCount),
  ];
  if (safer.requestedAvoidHighways) {
    bits.push(", and we asked the map to prefer less highway when reasonable");
  }
  if (safer.impliedAverageKmh + 5 < fastest.impliedAverageKmh) {
    bits.push(", with somewhat lower average speeds along the way");
  }
  bits.push(". ");
  bits.push("It may add a little time — worth it when you want an easier ride.");
  return bits.join("");
}

export function routesLookLikeSamePath(a: ParsedGoogleRoute, b: ParsedGoogleRoute): boolean {
  if (!a.encodedPolyline || !b.encodedPolyline) return false;
  if (a.encodedPolyline === b.encodedPolyline) return true;
  const minLen = Math.min(48, a.encodedPolyline.length, b.encodedPolyline.length);
  if (minLen < 12) return false;
  return a.encodedPolyline.slice(0, minLen) === b.encodedPolyline.slice(0, minLen);
}
