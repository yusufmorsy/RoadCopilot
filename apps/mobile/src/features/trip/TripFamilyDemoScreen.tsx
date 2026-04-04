import React, { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTripSession } from "../../hooks/useTripSession";
import FamilySummaryScreen from "../family/FamilySummaryScreen";
import { newTripEventId } from "../sensors/newTripEventId";
import { useMotionSensorLoop } from "../sensors/useMotionSensorLoop";
import { buildFamilySummaryView } from "./buildFamilySummary";

type Phase = "home" | "driving" | "summary";

export default function TripFamilyDemoScreen(): React.ReactElement {
  const {
    state,
    startTrip,
    endTrip,
    resetTrip,
    addTripEvent,
  } = useTripSession();
  const [phase, setPhase] = useState<Phase>("home");

  useMotionSensorLoop({
    isActive: state.isActive,
    tripId: state.tripId,
    onTripEvent: addTripEvent,
  });

  const summaryPayload = useMemo(() => {
    if (phase !== "summary") return null;
    return buildFamilySummaryView(state);
  }, [phase, state]);

  const onStart = () => {
    startTrip({
      routeModeLabel: "Safer Route",
      routeOptionId: "safer",
      destinationLabel: "Demo destination",
    });
    setPhase("driving");
  };

  const onEnd = () => {
    endTrip();
    setPhase("summary");
  };

  const onNewTrip = () => {
    resetTrip();
    setPhase("home");
  };

  if (phase === "summary" && summaryPayload) {
    return (
      <View style={styles.root}>
        <FamilySummaryScreen
          summary={summaryPayload.summary}
          extras={summaryPayload.extras}
          routeModeLabel={state.routeModeLabel}
        />
        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={onNewTrip}
            accessibilityRole="button"
            accessibilityLabel="Start a new trip"
          >
            <Text style={styles.primaryBtnText}>New trip</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (phase === "summary" && !summaryPayload) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Summary unavailable</Text>
        <Text style={styles.errorBody}>
          End the trip again after a full start, or return home.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={onNewTrip}>
          <Text style={styles.primaryBtnText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.appTitle}>RoadCopilot</Text>
        <Text style={styles.tagline}>
          On-device motion sensing — advisory, supportive, private.
        </Text>
      </View>

      {phase === "home" ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Before you drive</Text>
          <Text style={styles.body}>
            Start a trip to log gentle motion highlights. Nothing here controls the
            vehicle — it is awareness for you and family, on this phone only.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={onStart}
            accessibilityRole="button"
            accessibilityLabel="Start trip"
          >
            <Text style={styles.primaryBtnText}>Start trip</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Trip in progress</Text>
          <Text style={styles.mono}>Trip ID: {state.tripId ?? "—"}</Text>
          <View style={styles.stats}>
            <Stat label="Hard braking" value={state.hardBrakeCount} />
            <Stat label="Rapid acceleration" value={state.rapidAccelerationCount} />
            <Stat label="Sharp swerves" value={state.sharpSwerveCount} />
            <Stat label="Lane drift advisories" value={state.laneDriftCount} />
          </View>
          <Text style={styles.hint}>
            Sensors run only while a trip is active. Tune thresholds in{" "}
            <Text style={styles.hintEm}>src/features/sensors/sensorThresholds.ts</Text>.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() => {
              if (!state.tripId) return;
              addTripEvent({
                id: newTripEventId(),
                tripId: state.tripId,
                type: "lane_drift_advisory",
                occurredAt: new Date().toISOString(),
                severity: "low",
                description:
                  "Gentle lane awareness moment (placeholder until vision coaching connects).",
              });
            }}
            accessibilityRole="button"
            accessibilityLabel="Add a demo lane drift advisory event"
          >
            <Text style={styles.secondaryBtnText}>Demo: lane drift advisory</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={onEnd}
            accessibilityRole="button"
            accessibilityLabel="End trip and view family summary"
          >
            <Text style={styles.primaryBtnText}>End trip and summary</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}): React.ReactElement {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f1419" },
  center: {
    flex: 1,
    backgroundColor: "#0f1419",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  header: { paddingHorizontal: 22, paddingTop: 56, paddingBottom: 12 },
  appTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#f5f7fa",
    marginBottom: 8,
  },
  tagline: { fontSize: 17, lineHeight: 24, color: "#a8bdd4" },
  panel: { paddingHorizontal: 22, paddingTop: 8, gap: 14 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f0f4f8",
    marginBottom: 4,
  },
  body: {
    fontSize: 18,
    lineHeight: 26,
    color: "#d2dde8",
    marginBottom: 8,
  },
  mono: { fontSize: 14, color: "#8fa3b8", marginBottom: 4 },
  stats: {
    backgroundColor: "#1a2332",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#2a3a4f",
    gap: 10,
  },
  statRow: { flexDirection: "row", justifyContent: "space-between" },
  statLabel: { fontSize: 18, color: "#c5d4e5", fontWeight: "600" },
  statValue: { fontSize: 20, fontWeight: "800", color: "#ffffff" },
  hint: { fontSize: 15, lineHeight: 22, color: "#8fa3b8" },
  hintEm: { fontWeight: "700", color: "#b8cfe8" },
  primaryBtn: {
    backgroundColor: "#3d7dd9",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 6,
  },
  primaryBtnText: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "700",
  },
  secondaryBtn: {
    borderWidth: 2,
    borderColor: "#4d6f94",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: "#c5d4e5",
    fontSize: 17,
    fontWeight: "600",
  },
  pressed: { opacity: 0.88 },
  footer: {
    padding: 16,
    paddingBottom: 28,
    backgroundColor: "#0f1419",
    borderTopWidth: 1,
    borderTopColor: "#2a3a4f",
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#f5f7fa",
    marginBottom: 8,
  },
  errorBody: {
    fontSize: 16,
    color: "#a8bdd4",
    textAlign: "center",
    marginBottom: 20,
  },
});
