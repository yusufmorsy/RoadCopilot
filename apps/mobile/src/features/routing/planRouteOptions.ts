import type { RouteOption, RouteSafetyLabel } from "@roadcopilot/contracts";
import type { RouteGuidanceStep } from "../navigation/types";
import {
  computeDriveRoute,
  computeDriveRoutes,
  geocodeAddress,
  getGoogleMapsApiKeyFromEnv,
  type LatLng,
  type ParsedGoogleRoute,
} from "../../services/googleRoutesClient";
import { buildGuidanceStepsFromParsedSteps } from "./buildRouteGuidanceSteps";
import { buildMockGuidanceByOptionId } from "./mockGuidance";
import { buildMockRouteOptions } from "./mockRoutes";
import {
  buildFastestRationale,
  buildSaferRationale,
  easeCostFromHeuristics,
  routesLookLikeSamePath,
  safetyScoreFromHeuristics,
  summarizeRouteHeuristics,
} from "./safeRouteHeuristics";

/** Extra time allowed when searching for an easier alternative (15% of ETA, at least 4 minutes). */
const EASE_DURATION_SLACK_RATIO = 0.15;
const EASE_DURATION_MIN_EXTRA_SECONDS = 240;

const EASE_COMPARE_EPS = 1e-6;

function pickFastestByDuration(routes: ParsedGoogleRoute[]): ParsedGoogleRoute {
  let best = routes[0];
  for (let i = 1; i < routes.length; i += 1) {
    const r = routes[i];
    if (r.durationSeconds < best.durationSeconds) best = r;
    else if (r.durationSeconds === best.durationSeconds) {
      const er = easeCostFromHeuristics(summarizeRouteHeuristics(r));
      const eb = easeCostFromHeuristics(summarizeRouteHeuristics(best));
      if (er < eb) best = r;
    }
  }
  return best;
}

function pickEasiestByHeuristics(routes: ParsedGoogleRoute[]): ParsedGoogleRoute {
  let best = routes[0];
  let bestEase = easeCostFromHeuristics(summarizeRouteHeuristics(best));
  for (let i = 1; i < routes.length; i += 1) {
    const r = routes[i];
    const e = easeCostFromHeuristics(summarizeRouteHeuristics(r));
    if (e < bestEase - EASE_COMPARE_EPS) {
      best = r;
      bestEase = e;
    } else if (Math.abs(e - bestEase) <= EASE_COMPARE_EPS && r.durationSeconds < best.durationSeconds) {
      best = r;
      bestEase = e;
    }
  }
  return best;
}

function pickSaferRouteFromCandidates(params: {
  alternativeRoutes: ParsedGoogleRoute[];
  calmer: ParsedGoogleRoute | null;
}): ParsedGoogleRoute {
  const { alternativeRoutes, calmer } = params;
  const fastestRoute = pickFastestByDuration(alternativeRoutes);
  const extra = Math.max(
    fastestRoute.durationSeconds * EASE_DURATION_SLACK_RATIO,
    EASE_DURATION_MIN_EXTRA_SECONDS
  );
  const maxDuration = fastestRoute.durationSeconds + extra;
  const inWindow = alternativeRoutes.filter((r) => r.durationSeconds <= maxDuration);
  const pool = inWindow.length > 0 ? inWindow : alternativeRoutes;
  const easiestInPool = pickEasiestByHeuristics(pool);

  const easeFast = easeCostFromHeuristics(summarizeRouteHeuristics(fastestRoute));
  const easeEasy = easeCostFromHeuristics(summarizeRouteHeuristics(easiestInPool));

  let saferRoute: ParsedGoogleRoute =
    easeEasy < easeFast - EASE_COMPARE_EPS ? easiestInPool : (calmer ?? easiestInPool);

  if (
    calmer &&
    routesLookLikeSamePath(saferRoute, fastestRoute) &&
    !routesLookLikeSamePath(calmer, fastestRoute)
  ) {
    saferRoute = calmer;
  }

  return saferRoute;
}

export type GuidanceByOptionId = {
  fastest: RouteGuidanceStep[];
  safer: RouteGuidanceStep[];
};

export type PlannedRoutesResult = {
  formattedDestination: string;
  destinationLatLng: LatLng;
  options: RouteOption[];
  usedLiveGoogle: boolean;
  guidanceByOptionId: GuidanceByOptionId;
};

function prefixDestinationNote(label: string, text: string): string {
  const t = label.trim();
  if (!t) return text;
  return `Heading toward ${t}. ${text}`;
}

export async function planRouteOptionsFromDestinationText(params: {
  origin: LatLng;
  destinationQuery: string;
}): Promise<PlannedRoutesResult> {
  const key = getGoogleMapsApiKeyFromEnv();
  const query = params.destinationQuery.trim();
  const destLabel = query || "your destination";

  if (!key) {
    const fakeDest: LatLng = {
      latitude: params.origin.latitude + 0.04,
      longitude: params.origin.longitude + 0.04,
    };
    const options = buildMockRouteOptions(destLabel, fakeDest).map((opt, i) => {
      if (i === 0) {
        return { ...opt, rationale: prefixDestinationNote(destLabel, opt.rationale) };
      }
      return { ...opt, rationale: prefixDestinationNote(destLabel, opt.rationale) };
    });
    return {
      formattedDestination: destLabel,
      destinationLatLng: fakeDest,
      options,
      usedLiveGoogle: false,
      guidanceByOptionId: buildMockGuidanceByOptionId(params.origin, fakeDest),
    };
  }

  const geo = await geocodeAddress(key, query || destLabel);
  const alternativeRoutes = await computeDriveRoutes(key, params.origin, geo.latLng, {
    avoidHighways: false,
    computeAlternativeRoutes: true,
  });
  const calmer = await computeDriveRoute(key, params.origin, geo.latLng, { avoidHighways: true });

  if (alternativeRoutes.length === 0) {
    throw new Error("No route returned. Check that Routes API is enabled for your key.");
  }

  const fastest = pickFastestByDuration(alternativeRoutes);
  const saferRoute = pickSaferRouteFromCandidates({ alternativeRoutes, calmer });
  const samePath = routesLookLikeSamePath(fastest, saferRoute);
  const fastH = summarizeRouteHeuristics(fastest);
  const safeH = summarizeRouteHeuristics(saferRoute);

  const options: RouteOption[] = [
    {
      id: "fastest",
      label: "Fastest Route",
      geometry: { format: "polyline", data: fastest.encodedPolyline },
      safetyScore: safetyScoreFromHeuristics(fastH),
      safetyLabel: "acceptable" as RouteSafetyLabel,
      rationale: prefixDestinationNote(geo.formattedAddress, buildFastestRationale(fastH)),
      durationSecondsEstimate: fastest.durationSeconds,
      distanceMetersEstimate: fastest.distanceMeters,
    },
    {
      id: "safer",
      label: "Safer Route",
      geometry: { format: "polyline", data: saferRoute.encodedPolyline },
      safetyScore: safetyScoreFromHeuristics(safeH),
      safetyLabel: "preferred" as RouteSafetyLabel,
      rationale: prefixDestinationNote(geo.formattedAddress, buildSaferRationale(safeH, fastH, samePath)),
      durationSecondsEstimate: saferRoute.durationSeconds,
      distanceMetersEstimate: saferRoute.distanceMeters,
    },
  ];

  return {
    formattedDestination: geo.formattedAddress,
    destinationLatLng: geo.latLng,
    options,
    usedLiveGoogle: true,
    guidanceByOptionId: {
      fastest: buildGuidanceStepsFromParsedSteps(fastest.steps),
      safer: buildGuidanceStepsFromParsedSteps(saferRoute.steps),
    },
  };
}
