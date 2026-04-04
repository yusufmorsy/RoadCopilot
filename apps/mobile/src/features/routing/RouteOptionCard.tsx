import type { RouteOption } from "@roadcopilot/contracts";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

function formatDuration(seconds?: number): string {
  if (seconds == null || seconds <= 0) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `About ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `About ${h} h ${m} min`;
}

function formatDistance(meters?: number): string {
  if (meters == null || meters <= 0) return "—";
  const miles = meters / 1609.34;
  if (miles < 0.15) return `${Math.round(meters * 3.28084)} ft`;
  return `${miles.toFixed(1)} mi`;
}

function safetyBadge(label: RouteOption["safetyLabel"]): { text: string; tone: "good" | "ok" | "caution" } {
  switch (label) {
    case "preferred":
      return { text: "Calmer choice", tone: "good" };
    case "acceptable":
      return { text: "Fine when you are ready", tone: "ok" };
    case "use_caution":
      return { text: "Extra care", tone: "caution" };
    default:
      return { text: "", tone: "ok" };
  }
}

type Props = {
  option: RouteOption;
  selected: boolean;
  onSelect: () => void;
};

export function RouteOptionCard({ option, selected, onSelect }: Props) {
  const badge = safetyBadge(option.safetyLabel);
  return (
    <Pressable
      onPress={onSelect}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={styles.headerRow}>
        <Text style={styles.modeLabel}>{option.label}</Text>
        {badge.text ? (
          <View
            style={[
              styles.badge,
              badge.tone === "good" && styles.badge_good,
              badge.tone === "ok" && styles.badge_ok,
              badge.tone === "caution" && styles.badge_caution,
            ]}
          >
            <Text style={styles.badgeText}>{badge.text}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.metricsRow}>
        <Text style={styles.metric}>{formatDuration(option.durationSecondsEstimate)}</Text>
        <Text style={styles.metricSep}>·</Text>
        <Text style={styles.metric}>{formatDistance(option.distanceMetersEstimate)}</Text>
      </View>
      <Text style={styles.explainTitle}>Why this option</Text>
      <Text style={styles.rationale}>{option.rationale}</Text>
      <Text style={styles.scoreHint}>Ease score: {option.safetyScore} (higher is calmer for this demo)</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#d8dde3",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  cardSelected: {
    borderColor: "#2f6fed",
    backgroundColor: "#f4f7ff",
  },
  cardPressed: {
    opacity: 0.92,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  modeLabel: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1a1f26",
    flex: 1,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badge_good: { backgroundColor: "#e6f4ea" },
  badge_ok: { backgroundColor: "#eef1f6" },
  badge_caution: { backgroundColor: "#fce8e6" },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1a1f26",
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  metric: {
    fontSize: 15,
    color: "#3d4a5c",
  },
  metricSep: {
    marginHorizontal: 8,
    color: "#9aa3af",
    fontSize: 15,
  },
  explainTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#5c6570",
    marginBottom: 4,
  },
  rationale: {
    fontSize: 15,
    lineHeight: 22,
    color: "#2b333b",
  },
  scoreHint: {
    marginTop: 10,
    fontSize: 12,
    color: "#6b7280",
  },
});
