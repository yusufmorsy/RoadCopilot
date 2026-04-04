import type { TripEvent } from "@roadcopilot/contracts";
import React, { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import { tripSessionReducer } from "../features/trip/tripSessionReducer";
import type { TripSessionAction } from "../features/trip/tripSessionTypes";
import {
  initialTripSessionState,
  type TripSessionState,
} from "../features/trip/tripSessionTypes";

interface TripSessionContextValue {
  state: TripSessionState;
  dispatch: React.Dispatch<TripSessionAction>;
  startTrip: (opts?: {
    routeModeLabel?: string | null;
    routeOptionId?: string;
  }) => void;
  endTrip: () => void;
  resetTrip: () => void;
  addTripEvent: (event: TripEvent) => void;
  setLaneDriftCount: (count: number) => void;
  setRoutePlaceholder: (label: string | null, routeOptionId?: string) => void;
}

const TripSessionContext = createContext<TripSessionContextValue | null>(null);

export function TripSessionProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [state, dispatch] = useReducer(tripSessionReducer, initialTripSessionState);

  const startTrip = useCallback(
    (opts?: { routeModeLabel?: string | null; routeOptionId?: string }) => {
      dispatch({
        type: "START_TRIP",
        routeModeLabel: opts?.routeModeLabel,
        routeOptionId: opts?.routeOptionId,
      });
    },
    []
  );

  const endTrip = useCallback(() => {
    dispatch({ type: "END_TRIP" });
  }, []);

  const resetTrip = useCallback(() => {
    dispatch({ type: "RESET_TRIP" });
  }, []);

  const addTripEvent = useCallback((event: TripEvent) => {
    dispatch({ type: "ADD_TRIP_EVENT", event });
  }, []);

  const setLaneDriftCount = useCallback((count: number) => {
    dispatch({ type: "SET_LANE_DRIFT_COUNT", count });
  }, []);

  const setRoutePlaceholder = useCallback(
    (label: string | null, routeOptionId?: string) => {
      dispatch({ type: "SET_ROUTE_PLACEHOLDER", label, routeOptionId });
    },
    []
  );

  const value = useMemo(
    () => ({
      state,
      dispatch,
      startTrip,
      endTrip,
      resetTrip,
      addTripEvent,
      setLaneDriftCount,
      setRoutePlaceholder,
    }),
    [
      state,
      startTrip,
      endTrip,
      resetTrip,
      addTripEvent,
      setLaneDriftCount,
      setRoutePlaceholder,
    ]
  );

  return (
    <TripSessionContext.Provider value={value}>
      {children}
    </TripSessionContext.Provider>
  );
}

export function useTripSessionContext(): TripSessionContextValue {
  const ctx = useContext(TripSessionContext);
  if (!ctx) {
    throw new Error("useTripSessionContext must be used within TripSessionProvider");
  }
  return ctx;
}
