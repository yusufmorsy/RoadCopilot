import type { RouteOption } from "@roadcopilot/contracts";

/** UI / trip-integration mode — complements `RouteOption.id`. */
export type RouteModeId = "fastest" | "safer";

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
  /** Helpful for family summaries / UI when both options exist. */
  routeSummary: {
    fastestDurationSeconds?: number;
    saferDurationSeconds?: number;
    usedLiveGoogle: boolean;
  };
};
