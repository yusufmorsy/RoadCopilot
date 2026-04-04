import type { TripEvent } from "@roadcopilot/contracts";

export interface TripSessionState {
  tripId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  isActive: boolean;
  /** Display label until routing integration supplies a real mode. */
  routeModeLabel: string | null;
  routeOptionId: string | undefined;
  /** Filled by lane vision integration later; adjustable for demos. */
  laneDriftCount: number;
  hardBrakeCount: number;
  rapidAccelerationCount: number;
  sharpSwerveCount: number;
  events: TripEvent[];
}

export const initialTripSessionState: TripSessionState = {
  tripId: null,
  startedAt: null,
  endedAt: null,
  isActive: false,
  routeModeLabel: null,
  routeOptionId: undefined,
  laneDriftCount: 0,
  hardBrakeCount: 0,
  rapidAccelerationCount: 0,
  sharpSwerveCount: 0,
  events: [],
};

export type TripSessionAction =
  | { type: "START_TRIP"; routeModeLabel?: string | null; routeOptionId?: string }
  | { type: "END_TRIP" }
  | { type: "RESET_TRIP" }
  | { type: "ADD_TRIP_EVENT"; event: TripEvent }
  | { type: "SET_LANE_DRIFT_COUNT"; count: number }
  | { type: "SET_ROUTE_PLACEHOLDER"; label: string | null; routeOptionId?: string };
