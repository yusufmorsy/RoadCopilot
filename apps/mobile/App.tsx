import { StatusBar } from "expo-status-bar";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import FamilySummaryScreen from "./src/features/family/FamilySummaryScreen";
import { NavigationTripProvider } from "./src/features/navigation/NavigationTripContext";
import { SafeRoutingScreen } from "./src/features/routing/SafeRoutingScreen";
import { buildFamilySummaryView } from "./src/features/trip/buildFamilySummary";
import { DriveTripScreen } from "./src/features/trip/DriveTripScreen";
import { useTripSession } from "./src/hooks/useTripSession";
import { TripSessionProvider } from "./src/state/TripSessionContext";

type MainTab = "plan" | "drive" | "summary";

function AppShell(): ReactElement {
  const [tab, setTab] = useState<MainTab>("plan");
  const { state, resetTrip } = useTripSession();

  const summaryPayload = useMemo(() => buildFamilySummaryView(state), [state]);

  const darkStatus = tab === "drive" || tab === "summary";

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        <Pressable
          onPress={() => setTab("plan")}
          style={[styles.tab, tab === "plan" && styles.tabActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "plan" }}
        >
          <Text style={[styles.tabText, tab === "plan" && styles.tabTextActive]}>Plan</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("drive")}
          style={[styles.tab, tab === "drive" && styles.tabActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "drive" }}
        >
          <Text style={[styles.tabText, tab === "drive" && styles.tabTextActive]}>Drive</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("summary")}
          style={[styles.tab, tab === "summary" && styles.tabActive]}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "summary" }}
        >
          <Text style={[styles.tabText, tab === "summary" && styles.tabTextActive]}>Summary</Text>
        </Pressable>
      </View>
      <View style={styles.body}>
        {tab === "plan" ? (
          <SafeRoutingScreen onContinueToDrive={() => setTab("drive")} />
        ) : null}
        {tab === "drive" ? (
          <DriveTripScreen
            onGoToPlan={() => setTab("plan")}
            onTripEnded={() => setTab("summary")}
          />
        ) : null}
        {tab === "summary" ? (
          summaryPayload ? (
            <View style={styles.summaryWrap}>
              <FamilySummaryScreen
                summary={summaryPayload.summary}
                extras={summaryPayload.extras}
                routeModeLabel={state.routeModeLabel}
              />
              <View style={styles.summaryFooter}>
                <Pressable
                  style={({ pressed }) => [styles.footerBtn, pressed && styles.pressed]}
                  onPress={() => {
                    resetTrip();
                    setTab("drive");
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Start a new trip"
                >
                  <Text style={styles.footerBtnText}>New trip</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.summaryEmpty}>
              <Text style={styles.summaryEmptyTitle}>No summary yet</Text>
              <Text style={styles.summaryEmptyBody}>
                {state.isActive
                  ? "When you are finished driving, end the trip on the Drive tab. A calm snapshot for family will show here."
                  : "Plan a route, drive with an active trip, then end it to see a gentle, factual summary."}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.footerBtn, pressed && styles.pressed]}
                onPress={() => setTab(state.isActive ? "drive" : "plan")}
                accessibilityRole="button"
                accessibilityLabel={state.isActive ? "Go to drive" : "Go to plan route"}
              >
                <Text style={styles.footerBtnText}>
                  {state.isActive ? "Go to Drive" : "Go to Plan"}
                </Text>
              </Pressable>
            </View>
          )
        ) : null}
      </View>
      <StatusBar style={darkStatus ? "light" : "dark"} />
    </View>
  );
}

/**
 * Plan route → Drive (trip + lane + motion) → Summary (family view).
 */
export default function App(): ReactElement {
  return (
    <NavigationTripProvider>
      <TripSessionProvider>
        <AppShell />
      </TripSessionProvider>
    </NavigationTripProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#f6f7f8",
  },
  tabs: {
    flexDirection: "row",
    paddingTop: 48,
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 6,
    backgroundColor: "#f6f7f8",
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#e5e7eb",
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#2563eb",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  tabTextActive: {
    color: "#fff",
  },
  body: {
    flex: 1,
  },
  summaryWrap: {
    flex: 1,
    backgroundColor: "#0f1419",
  },
  summaryFooter: {
    padding: 16,
    paddingBottom: 28,
    backgroundColor: "#0f1419",
    borderTopWidth: 1,
    borderTopColor: "#2a3a4f",
  },
  summaryEmpty: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 56,
    justifyContent: "flex-start",
  },
  summaryEmptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },
  summaryEmptyBody: {
    fontSize: 16,
    lineHeight: 24,
    color: "#4b5563",
    marginBottom: 22,
  },
  footerBtn: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  footerBtnText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  pressed: { opacity: 0.9 },
});
