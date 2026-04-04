import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
/**
 * Placeholder shell — feature work is tracked in TASKS.md.
 * Shared types: `@roadcopilot/contracts` (see apps/mobile/package.json).
 */
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>RoadCopilot</Text>
      <Text style={styles.subtitle}>
        Advisory driving support — scaffold only. See README and TASKS.md.
      </Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f7f8",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#444",
  },
});
