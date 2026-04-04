import { Accelerometer } from "expo-sensors";
import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTripSession } from "../../hooks/useTripSession";
import { LaneDriveScreen } from "../vision/LaneDriveScreen";
import { useNavigationTrip } from "../navigation/NavigationTripContext";
import { useMotionSensorLoop } from "../sensors/useMotionSensorLoop";

export type DriveTripScreenProps = {
  onGoToPlan: () => void;
  onTripEnded: () => void;
};

export function DriveTripScreen({
  onGoToPlan,
  onTripEnded,
}: DriveTripScreenProps): React.ReactElement {
  const { trip: navTrip } = useNavigationTrip();
  const { state, startTrip, endTrip, resetTrip, addTripEvent } = useTripSession();
  const [motionOk, setMotionOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Accelerometer.isAvailableAsync().then((ok) => {
      if (!cancelled) setMotionOk(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useMotionSensorLoop({
    isActive: state.isActive,
    tripId: state.tripId,
    onTripEvent: addTripEvent,
  });

  const onStartTrip = useCallback(() => {
    if (!navTrip) return;
    startTrip({
      routeModeLabel: navTrip.selectedRoute.label,
      routeOptionId: navTrip.selectedRoute.id,
      destinationLabel: navTrip.destinationLabel,
    });
  }, [navTrip, startTrip]);

  const onEndTrip = useCallback(() => {
    endTrip();
    onTripEnded();
  }, [endTrip, onTripEnded]);

  if (!navTrip) {
    if (state.isActive) {
      return (
        <View style={styles.panel}>
          <Text style={styles.title}>Route was cleared</Text>
          <Text style={styles.body}>
            The saved route was removed on the Plan tab while this trip was still active. When it is
            safe, end the trip here — sensor logging stops after you do.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={onEndTrip}
            accessibilityRole="button"
            accessibilityLabel="End trip"
          >
            <Text style={styles.primaryBtnText}>End trip</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={onGoToPlan}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>Open Plan tab</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>Plan before you drive</Text>
        <Text style={styles.body}>
          Choose a destination and a fastest or calmer route on the Plan tab first. RoadCopilot stays
          advisory only — nothing here steers or brakes for you.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={onGoToPlan}
          accessibilityRole="button"
          accessibilityLabel="Go to plan route"
        >
          <Text style={styles.primaryBtnText}>Go to plan route</Text>
        </Pressable>
      </View>
    );
  }

  const preStart = !state.isActive && !state.endedAt;
  const completed = Boolean(state.endedAt && !state.isActive);

  if (completed) {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>Trip complete</Text>
        <Text style={styles.body}>
          Your family summary is on the Summary tab. When you are ready for another drive, start a new
          trip here — your last planned route is still available until you change it on Plan.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={onTripEnded}
          accessibilityRole="button"
          accessibilityLabel="Open family summary"
        >
          <Text style={styles.primaryBtnText}>Open family summary</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={onGoToPlan}
          accessibilityRole="button"
          accessibilityLabel="Change route on plan tab"
        >
          <Text style={styles.secondaryBtnText}>Change route on Plan</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed, styles.spaced]}
          onPress={() => {
            resetTrip();
          }}
          accessibilityRole="button"
          accessibilityLabel="Start another trip with the same route"
        >
          <Text style={styles.secondaryBtnText}>Start another trip</Text>
        </Pressable>
      </View>
    );
  }

  if (preStart) {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>Ready when you are</Text>
        <Text style={styles.dest}>{navTrip.destinationLabel}</Text>
        <Text style={styles.routeLine}>
          {navTrip.selectedRoute.label} · planned for a calm, informed drive
        </Text>
        {motionOk === false ? (
          <Text style={styles.warn}>
            Motion sensors are not available on this device, so slowdown and turn highlights may not
            appear. Lane awareness still works when the camera can see the road.
          </Text>
        ) : (
          <Text style={styles.hint}>
            Starting logs gentle motion moments on this phone and optional lane cues — all advisory.
          </Text>
        )}
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={onStartTrip}
          accessibilityRole="button"
          accessibilityLabel="Start trip"
        >
          <Text style={styles.primaryBtnText}>Start trip</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          onPress={onGoToPlan}
          accessibilityRole="button"
        >
          <Text style={styles.secondaryBtnText}>Back to route choices</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LaneDriveScreen
        tripLaneLog={{
          isActive: state.isActive,
          tripId: state.tripId,
          addTripEvent,
        }}
        laneAdvisoryEnabled={state.isActive}
      />
      <View style={styles.topBar} pointerEvents="box-none">
        <View style={styles.topCard}>
          <Text style={styles.topDest} numberOfLines={1}>
            {navTrip.destinationLabel}
          </Text>
          <Text style={styles.topSub} numberOfLines={1}>
            {navTrip.selectedRoute.label} · trip active
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.endBtn, pressed && styles.pressed]}
          onPress={onEndTrip}
          accessibilityRole="button"
          accessibilityLabel="End trip and view summary"
        >
          <Text style={styles.endBtnText}>End trip</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  panel: {
    flex: 1,
    backgroundColor: "#f6f7f8",
    paddingHorizontal: 22,
    paddingTop: 56,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  body: {
    fontSize: 17,
    lineHeight: 26,
    color: "#374151",
    marginBottom: 20,
  },
  dest: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  routeLine: {
    fontSize: 16,
    lineHeight: 24,
    color: "#4b5563",
    marginBottom: 16,
  },
  hint: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6b7280",
    marginBottom: 20,
  },
  warn: {
    fontSize: 15,
    lineHeight: 22,
    color: "#92400e",
    backgroundColor: "#fffbeb",
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    overflow: "hidden",
  },
  primaryBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
  },
  secondaryBtnText: { color: "#2563eb", fontSize: 16, fontWeight: "600" },
  pressed: { opacity: 0.9 },
  topBar: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-start",
    alignItems: "stretch",
    paddingTop: 52,
    paddingHorizontal: 12,
  },
  topCard: {
    backgroundColor: "rgba(0,0,0,0.72)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  topDest: { color: "#fff", fontSize: 16, fontWeight: "700" },
  topSub: { color: "#cbd5e1", fontSize: 14, marginTop: 4 },
  spaced: { marginTop: 10 },
  endBtn: {
    alignSelf: "flex-end",
    backgroundColor: "#1e3a5f",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  endBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
