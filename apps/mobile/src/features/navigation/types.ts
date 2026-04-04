import type { RouteOption } from "@roadcopilot/contracts";

/** UI / trip-integration mode — complements `RouteOption.id`. */
export type RouteModeId = "fastest" | "safer";

/** One spoken hint tied to the end of a route step (mobile-only; not in contracts). */
export type RouteGuidanceStep = {
  announceText: string;
  endLatLng: { latitude: number; longitude: number };
};

/**
 * Navigation-ready snapshot for the rest of the app (trip start, replay, etc.).
 * Uses `RouteOption` from `@roadcopilot/contracts` without redefining it.
 */
export type NavigationReadyTripState = {
  destinationLabel: string;
  destinationLatLng: { latitude: number; longitude: number };
  originLatLng: { latitude: number; longitude: number };
  selectedRouteMode: RouteModeId;
  selectedRoute: RouteOption;
  plannedAtIso: string;
  /** Advisory voice hints along the selected route (empty if unavailable). */
  guidanceSteps: RouteGuidanceStep[];
  /** Helpful for family summaries / UI when both options exist. */
  routeSummary: {
    fastestDurationSeconds?: number;
    saferDurationSeconds?: number;
    usedLiveGoogle: boolean;
  };
};
