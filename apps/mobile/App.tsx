import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { LaneDriveScreen } from "./src/features/vision/LaneDriveScreen";
import { NavigationTripProvider } from "./src/features/navigation/NavigationTripContext";
import { SafeRoutingScreen } from "./src/features/routing/SafeRoutingScreen";

type MainTab = "routes" | "lane";

/**
 * Routes + lane assist: safe-routing owns the Plan tab; vision owns lane UI.
 */
export default function App() {
  const [tab, setTab] = useState<MainTab>("routes");

  return (
    <NavigationTripProvider>
      <View style={styles.root}>
        <View style={styles.tabs}>
          <Pressable
            onPress={() => setTab("routes")}
            style={[styles.tab, tab === "routes" && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === "routes" }}
          >
            <Text style={[styles.tabText, tab === "routes" && styles.tabTextActive]}>Plan route</Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("lane")}
            style={[styles.tab, tab === "lane" && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === "lane" }}
          >
            <Text style={[styles.tabText, tab === "lane" && styles.tabTextActive]}>Lane assist</Text>
          </Pressable>
        </View>
        <View style={styles.body}>
          {tab === "routes" ? <SafeRoutingScreen /> : <LaneDriveScreen />}
        </View>
        <StatusBar style={tab === "lane" ? "light" : "dark"} />
      </View>
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
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8,
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
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  tabTextActive: {
    color: "#fff",
  },
  body: {
    flex: 1,
  },
});
