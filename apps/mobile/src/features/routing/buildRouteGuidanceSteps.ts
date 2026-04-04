import type { RouteGuidanceStep } from "../navigation/types";
import { announceTextForParsedStep } from "../voice/routeGuidancePhrases";
import type { LatLng, ParsedRouteStep } from "../../services/googleRoutesClient";
import { decodePolyline } from "./decodePolyline";

function endLatLngForStep(step: ParsedRouteStep): LatLng | undefined {
  if (step.endLatLng) return step.endLatLng;
  if (!step.encodedPolyline?.trim()) return undefined;
  const pts = decodePolyline(step.encodedPolyline);
  if (pts.length === 0) return undefined;
  return pts[pts.length - 1];
}

/**
 * Builds ordered guidance points for voice: each item is spoken when the driver approaches
 * the *previous* step's end (except the first, spoken at trip start).
 */
export function buildGuidanceStepsFromParsedSteps(steps: ParsedRouteStep[]): RouteGuidanceStep[] {
  const out: RouteGuidanceStep[] = [];
  for (const step of steps) {
    const announceText = announceTextForParsedStep(step);
    const endLatLng = endLatLngForStep(step);
    if (!announceText || !endLatLng) continue;
    out.push({ announceText, endLatLng });
  }
  return out;
}
