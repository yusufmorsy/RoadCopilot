import { newTripEventId } from "../sensors/newTripEventId";
import type { TripSessionAction, TripSessionState } from "./tripSessionTypes";
import { initialTripSessionState } from "./tripSessionTypes";

function newTripId(): string {
  return newTripEventId();
}

export function tripSessionReducer(
  state: TripSessionState,
  action: TripSessionAction
): TripSessionState {
  switch (action.type) {
    case "START_TRIP":
      return {
        ...initialTripSessionState,
        tripId: newTripId(),
        startedAt: new Date().toISOString(),
        isActive: true,
        routeModeLabel: action.routeModeLabel ?? "Not connected yet",
        destinationLabel: action.destinationLabel ?? null,
        routeOptionId: action.routeOptionId,
      };
    case "END_TRIP":
      if (!state.isActive) return state;
      return {
        ...state,
        isActive: false,
        endedAt: new Date().toISOString(),
      };
    case "RESET_TRIP":
      return { ...initialTripSessionState };
    case "ADD_TRIP_EVENT": {
      const e = action.event;
      const events = [...state.events, e].sort(
        (a, b) =>
          new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
      );
      const next = { ...state, events };
      if (e.type === "hard_brake")
        return { ...next, hardBrakeCount: state.hardBrakeCount + 1 };
      if (e.type === "rapid_acceleration")
        return {
          ...next,
          rapidAccelerationCount: state.rapidAccelerationCount + 1,
        };
      if (e.type === "sharp_swerve")
        return { ...next, sharpSwerveCount: state.sharpSwerveCount + 1 };
      if (e.type === "lane_drift_advisory")
        return { ...next, laneDriftCount: state.laneDriftCount + 1 };
      return next;
    }
    case "SET_LANE_DRIFT_COUNT":
      return { ...state, laneDriftCount: Math.max(0, action.count) };
    case "SET_ROUTE_PLACEHOLDER":
      return {
        ...state,
        routeModeLabel: action.label,
        routeOptionId: action.routeOptionId ?? state.routeOptionId,
      };
    default:
      return state;
  }
}
