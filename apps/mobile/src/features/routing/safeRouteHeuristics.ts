import type { ParsedGoogleRoute } from "../../services/googleRoutesClient";

/** Align REST/proto maneuver spellings (e.g. UTURN_LEFT vs U_TURN_LEFT). */
export function normalizeManeuver(m: string | undefined): string | undefined {
  if (!m || typeof m !== "string") return undefined;
  const u = m.trim().toUpperCase();
  if (!u) return undefined;
  return u.replace(/\bUTURN\b/g, "U_TURN").replace(/UTURN/g, "U_TURN");
}

const IGNORE_FOR_SIGNIFICANT = new Set([
  "STRAIGHT",
  "DEPART",
  "NAME_CHANGE",
  "MANEUVER_UNSPECIFIED",
]);

export type RouteHeuristicSummary = {
  /** Classic left turns (sharp / left / slight); excludes U-turns. */
  leftTurnCount: number;
  rightTurnCount: number;
  /** Weighted stress from left maneuvers (sharp > left > slight). */
  weightedLeftBurden: number;
  mergeRampForkCount: number;
  roundaboutCount: number;
  uTurnCount: number;
  /** Steps where the driver is prompted for something other than straight/depart/name. */
  significantManeuverCount: number;
  stepCount: number;
  impliedAverageKmh: number;
  requestedAvoidHighways: boolean;
};

function maneuverFamily(norm: string | undefined): {
  leftClassic: boolean;
  rightClassic: boolean;
  uTurn: boolean;
  roundabout: boolean;
  mergeRampFork: boolean;
  leftWeight: number;
  rightWeight: number;
} {
  if (!norm) {
    return {
      leftClassic: false,
      rightClassic: false,
      uTurn: false,
      roundabout: false,
      mergeRampFork: false,
      leftWeight: 0,
      rightWeight: 0,
    };
  }
  const uTurn =
    norm === "U_TURN" ||
    norm === "U_TURN_LEFT" ||
    norm === "U_TURN_RIGHT" ||
    norm.includes("U_TURN");
  const roundabout = norm.includes("ROUNDABOUT");
  const mergeRampFork =
    norm === "MERGE" ||
    norm === "RAMP_LEFT" ||
    norm === "RAMP_RIGHT" ||
    norm === "FORK_LEFT" ||
    norm === "FORK_RIGHT";

  let leftWeight = 0;
  let leftClassic = false;
  if (norm === "TURN_SHARP_LEFT") {
    leftWeight = 4;
    leftClassic = true;
  } else if (norm === "TURN_SLIGHT_LEFT" || norm === "SLIGHT_LEFT") {
    leftWeight = 1.5;
    leftClassic = true;
  } else if (norm === "TURN_LEFT") {
    leftWeight = 3;
    leftClassic = true;
  }

  let rightWeight = 0;
  let rightClassic = false;
  if (norm === "TURN_SHARP_RIGHT" || norm === "TURN_SLIGHT_RIGHT" || norm === "SLIGHT_RIGHT") {
    if (norm === "TURN_SHARP_RIGHT") rightWeight = 1.2;
    else rightWeight = 0.45;
    rightClassic = true;
  } else if (norm === "TURN_RIGHT") {
    rightWeight = 0.75;
    rightClassic = true;
  }

  return {
    leftClassic,
    rightClassic,
    uTurn,
    roundabout,
    mergeRampFork,
    leftWeight,
    rightWeight,
  };
}

function isSignificantManeuver(norm: string | undefined): boolean {
  if (!norm) return false;
  if (IGNORE_FOR_SIGNIFICANT.has(norm)) return false;
  return true;
}

export function summarizeRouteHeuristics(route: ParsedGoogleRoute): RouteHeuristicSummary {
  let leftTurnCount = 0;
  let rightTurnCount = 0;
  let weightedLeftBurden = 0;
  let mergeRampForkCount = 0;
  let roundaboutCount = 0;
  let uTurnCount = 0;
  let significantManeuverCount = 0;

  for (const step of route.steps) {
    const norm = normalizeManeuver(step.maneuver);
    const fam = maneuverFamily(norm);

    if (fam.leftClassic) {
      leftTurnCount += 1;
      weightedLeftBurden += fam.leftWeight;
    }
    if (fam.rightClassic) rightTurnCount += 1;
    if (fam.uTurn) uTurnCount += 1;
    if (fam.roundabout) roundaboutCount += 1;
    if (fam.mergeRampFork) mergeRampForkCount += 1;
    if (isSignificantManeuver(norm)) significantManeuverCount += 1;

    if (fam.uTurn) weightedLeftBurden += 5;
  }

  const hours = route.durationSeconds > 0 ? route.durationSeconds / 3600 : 0;
  const km = route.distanceMeters / 1000;
  const impliedAverageKmh = hours > 0 ? km / hours : 0;

  return {
    leftTurnCount,
    rightTurnCount,
    weightedLeftBurden,
    mergeRampForkCount,
    roundaboutCount,
    uTurnCount,
    significantManeuverCount,
    stepCount: route.steps.length,
    impliedAverageKmh,
    requestedAvoidHighways: route.requestedAvoidHighways,
  };
}

/**
 * Lower is easier (fewer stressful maneuvers). Used to pick among time-feasible alternatives.
 */
export function easeCostFromHeuristics(h: RouteHeuristicSummary): number {
  return (
    h.weightedLeftBurden * 1.15 +
    h.uTurnCount * 5.5 +
    h.mergeRampForkCount * 3.8 +
    h.roundaboutCount * 2.8 +
    h.rightTurnCount * 0.55 +
    Math.max(0, h.significantManeuverCount - h.leftTurnCount - h.rightTurnCount - h.uTurnCount) * 0.35
  );
}

/** Higher is better (safer / calmer proxy). */
export function safetyScoreFromHeuristics(h: RouteHeuristicSummary): number {
  let score = 74;
  score -= Math.min(h.weightedLeftBurden * 2.2, 22);
  score -= Math.min(h.uTurnCount * 5, 12);
  score -= Math.min(h.mergeRampForkCount * 2.5, 10);
  score -= Math.min(h.roundaboutCount * 1.8, 8);
  score -= Math.min(h.rightTurnCount * 0.35, 4);
  score -= h.impliedAverageKmh > 88 ? 8 : h.impliedAverageKmh > 72 ? 4 : 0;
  if (h.requestedAvoidHighways) score += 8;
  score -= Math.min(Math.max(0, h.significantManeuverCount - 18) * 0.12, 7);
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

function easeComparisonPhrase(safer: RouteHeuristicSummary, fastest: RouteHeuristicSummary): string | null {
  const parts: string[] = [];
  if (safer.mergeRampForkCount < fastest.mergeRampForkCount) {
    parts.push("fewer merges and highway-style forks");
  }
  if (safer.roundaboutCount < fastest.roundaboutCount) {
    parts.push("fewer roundabouts");
  }
  if (safer.significantManeuverCount < fastest.significantManeuverCount - 2) {
    parts.push("a bit less to track step-by-step");
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export function buildFastestRationale(fast: RouteHeuristicSummary): string {
  const parts: string[] = [
    `Gets you there in the shortest time we found (${plainLeftTurnPhrase(fast.leftTurnCount)}`,
  ];
  if (fast.uTurnCount > 0) {
    parts.push(`, plus ${fast.uTurnCount === 1 ? "one" : fast.uTurnCount} U-turn${fast.uTurnCount === 1 ? "" : "s"} in the list`);
  }
  parts.push("). ");
  if (fast.mergeRampForkCount > 0 || fast.roundaboutCount > 0) {
    const bits: string[] = [];
    if (fast.mergeRampForkCount > 0) bits.push(`${fast.mergeRampForkCount} merge or ramp-style step${fast.mergeRampForkCount === 1 ? "" : "s"}`);
    if (fast.roundaboutCount > 0) bits.push(`${fast.roundaboutCount} roundabout${fast.roundaboutCount === 1 ? "" : "s"}`);
    parts.push(`Along the way it lists ${bits.join(" and ")}. `);
  }
  if (fast.impliedAverageKmh > 80) {
    parts.push("It may use faster roads, including highways when they help. ");
  }
  parts.push("Fine when you are comfortable with that pace.");
  return parts.join("");
}

export function buildSaferRationale(
  safer: RouteHeuristicSummary,
  fastest: RouteHeuristicSummary,
  samePath: boolean
): string {
  if (samePath) {
    return "For this trip, the calmer-style choice matches the fastest path — a straightforward drive with no separate easier option from the map data.";
  }
  const bits: string[] = [
    "Safer Route favors an easier drive: ",
    plainLeftTurnPhrase(safer.leftTurnCount, fastest.leftTurnCount),
  ];
  if (safer.uTurnCount < fastest.uTurnCount && fastest.uTurnCount > 0) {
    bits.push(
      safer.uTurnCount === 0
        ? ", and the step list shows no U-turns compared with the faster option"
        : `, and fewer U-turns in the list (${safer.uTurnCount} vs ${fastest.uTurnCount})`
    );
  }
  const easeBits = easeComparisonPhrase(safer, fastest);
  if (easeBits) {
    bits.push(`, with ${easeBits}`);
  }
  if (safer.requestedAvoidHighways) {
    bits.push("; we also asked the map to prefer less highway when reasonable");
  }
  if (safer.impliedAverageKmh + 5 < fastest.impliedAverageKmh) {
    bits.push(", with somewhat lower average speeds along the way");
  }
  bits.push(". ");
  bits.push("It may add a little time — worth it when you want an easier ride.");
  return bits.join("");
}

export function encodedPolylinesLookLikeSamePath(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const minLen = Math.min(48, a.length, b.length);
  if (minLen < 12) return false;
  return a.slice(0, minLen) === b.slice(0, minLen);
}

export function routesLookLikeSamePath(a: ParsedGoogleRoute, b: ParsedGoogleRoute): boolean {
  return encodedPolylinesLookLikeSamePath(a.encodedPolyline, b.encodedPolyline);
}
