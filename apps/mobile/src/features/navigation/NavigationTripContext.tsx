import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { NavigationReadyTripState } from "./types";

type NavigationTripContextValue = {
  trip: NavigationReadyTripState | null;
  setTrip: (trip: NavigationReadyTripState | null) => void;
  clearTrip: () => void;
};

const NavigationTripContext = createContext<NavigationTripContextValue | undefined>(undefined);

export function NavigationTripProvider({ children }: { children: React.ReactNode }) {
  const [trip, setTrip] = useState<NavigationReadyTripState | null>(null);
  const clearTrip = useCallback(() => setTrip(null), []);

  const value = useMemo(
    () => ({
      trip,
      setTrip,
      clearTrip,
    }),
    [trip, clearTrip]
  );

  return <NavigationTripContext.Provider value={value}>{children}</NavigationTripContext.Provider>;
}

export function useNavigationTrip(): NavigationTripContextValue {
  const ctx = useContext(NavigationTripContext);
  if (!ctx) {
    throw new Error("useNavigationTrip must be used within NavigationTripProvider");
  }
  return ctx;
}
