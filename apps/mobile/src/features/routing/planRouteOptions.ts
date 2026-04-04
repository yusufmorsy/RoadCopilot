import type { RouteOption, RouteSafetyLabel } from "@roadcopilot/contracts";
import {
  computeDriveRoute,
  geocodeAddress,
  getGoogleMapsApiKeyFromEnv,
  type LatLng,
} from "../../services/googleRoutesClient";
import { buildMockRouteOptions } from "./mockRoutes";
import {
  buildFastestRationale,
  buildSaferRationale,
  routesLookLikeSamePath,
  safetyScoreFromHeuristics,
  summarizeRouteHeuristics,
} from "./safeRouteHeuristics";

export type PlannedRoutesResult = {
  formattedDestination: string;
  destinationLatLng: LatLng;
  options: RouteOption[];
  usedLiveGoogle: boolean;
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
    };
  }

  const geo = await geocodeAddress(key, query || destLabel);
  const fastest = await computeDriveRoute(key, params.origin, geo.latLng, { avoidHighways: false });
  const calmer = await computeDriveRoute(key, params.origin, geo.latLng, { avoidHighways: true });

  if (!fastest) {
    throw new Error("No route returned. Check that Routes API is enabled for your key.");
  }

  const saferRoute = calmer ?? fastest;
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
  };
}
