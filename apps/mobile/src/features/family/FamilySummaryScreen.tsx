import type { FamilySummary } from "@roadcopilot/contracts";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { FamilySummaryExtras } from "../trip/buildFamilySummary";

export interface FamilySummaryScreenProps {
  summary: FamilySummary;
  extras: FamilySummaryExtras;
  routeModeLabel: string | null;
  onDone?: () => void;
}

function formatClock(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function FamilySummaryScreen({
  summary,
  extras,
  routeModeLabel,
  onDone,
}: FamilySummaryScreenProps): React.ReactElement {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <Text style={styles.kicker}>Family summary</Text>
      <Text style={styles.headline}>{summary.headline}</Text>
      <Text style={styles.narrative}>{extras.narrativeLine}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trip overview</Text>
        <Row label="Duration" value={extras.tripDurationLabel} />
        {extras.destinationLabel ? (
          <Row label="Destination" value={extras.destinationLabel} />
        ) : null}
        <Row
          label="Route mode"
          value={routeModeLabel ?? "Not connected yet"}
        />
        <Row
          label="Support score"
          value={`${extras.supportScore} / 100`}
          hint="Higher means fewer sensor highlights — advisory only."
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What we noticed</Text>
        <Row label="Hard braking" value={String(summary.eventRollups.find((r) => r.type === "hard_brake")?.count ?? 0)} />
        <Row
          label="Rapid acceleration"
          value={String(
            summary.eventRollups.find((r) => r.type === "rapid_acceleration")?.count ?? 0
          )}
        />
        <Row
          label="Sharp swerves"
          value={String(summary.eventRollups.find((r) => r.type === "sharp_swerve")?.count ?? 0)}
        />
        <Row
          label="Lane drift alerts"
          value={String(
            summary.eventRollups.find((r) => r.type === "lane_drift_advisory")?.count ?? 0
          )}
          hint="Advisory cues from lane awareness during the trip — not a judgment."
        />
      </View>

      <View style={[styles.card, styles.accentCard]}>
        <Text style={styles.cardTitle}>Top contributor</Text>
        <Text style={styles.body}>{extras.topContributorMessage}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Highlights</Text>
        {summary.highlights.map((line, i) => (
          <Text key={i} style={styles.bullet}>
            {"\u2022 "} {line}
          </Text>
        ))}
      </View>

      {summary.eventRollups.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Supportive rollups</Text>
          {summary.eventRollups.map((r) => (
            <View key={r.type} style={styles.rollupRow}>
              <Text style={styles.rollupCount}>{r.count}</Text>
              <View style={styles.rollupText}>
                <Text style={styles.rollupPhrase}>{r.supportivePhrase}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Event timeline</Text>
        {extras.timeline.length === 0 ? (
          <Text style={styles.bodyMuted}>No moments were logged on this trip.</Text>
        ) : (
          extras.timeline.map((item, idx) => (
            <View key={`${item.occurredAt}-${idx}`} style={styles.timelineRow}>
              <Text style={styles.timelineTime}>{formatClock(item.occurredAt)}</Text>
              <Text style={styles.timelineLabel}>{item.label}</Text>
            </View>
          ))
        )}
      </View>

      {onDone ? (
        <Text style={styles.footerHint}>
          When you are ready, use the button below to start a fresh trip.
        </Text>
      ) : null}
    </ScrollView>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}): React.ReactElement {
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
      {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#0f1419" },
  scrollContent: { padding: 22, paddingBottom: 48 },
  kicker: {
    fontSize: 15,
    fontWeight: "600",
    color: "#9ab0c7",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  headline: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    color: "#f5f7fa",
    marginBottom: 14,
  },
  narrative: {
    fontSize: 20,
    lineHeight: 28,
    color: "#dce6f2",
    marginBottom: 22,
  },
  card: {
    backgroundColor: "#1a2332",
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#2a3a4f",
  },
  accentCard: {
    backgroundColor: "#243447",
    borderColor: "#3d5675",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#f0f4f8",
    marginBottom: 12,
  },
  row: { marginBottom: 12 },
  rowMain: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  rowLabel: {
    flex: 1,
    fontSize: 18,
    color: "#c5d4e5",
    fontWeight: "600",
  },
  rowValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "right",
  },
  rowHint: {
    marginTop: 4,
    fontSize: 15,
    color: "#8fa3b8",
    lineHeight: 20,
  },
  body: {
    fontSize: 19,
    lineHeight: 27,
    color: "#e8eef5",
  },
  bodyMuted: {
    fontSize: 17,
    lineHeight: 24,
    color: "#9aaab8",
  },
  bullet: {
    fontSize: 17,
    lineHeight: 26,
    color: "#d8e2ec",
    marginBottom: 10,
  },
  rollupRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 12,
  },
  rollupCount: {
    fontSize: 22,
    fontWeight: "800",
    color: "#7eb8ff",
    minWidth: 36,
  },
  rollupPhrase: {
    fontSize: 17,
    lineHeight: 24,
    color: "#e3edf7",
  },
  rollupText: { flex: 1 },
  timelineRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#33475f",
  },
  timelineTime: {
    fontSize: 15,
    fontWeight: "700",
    color: "#8eb4d9",
    marginBottom: 4,
  },
  timelineLabel: {
    fontSize: 17,
    lineHeight: 24,
    color: "#eef4fa",
  },
  footerHint: {
    fontSize: 16,
    color: "#9aaab8",
    textAlign: "center",
    marginTop: 8,
  },
});
