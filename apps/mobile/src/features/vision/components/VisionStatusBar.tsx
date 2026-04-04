import { StyleSheet, Text, View } from "react-native";

type Props = {
  cameraLive: boolean;
  permissionGranted: boolean;
  backendOk: boolean;
  backendMessage?: string | null;
  inFlight: boolean;
  /** Smaller type and spacing for embedded lane strip. */
  compact?: boolean;
};

/**
 * Small, high-contrast indicators: camera + whether a frame round-trip is running.
 */
export function VisionStatusBar(props: Props) {
  const {
    cameraLive,
    permissionGranted,
    backendOk,
    backendMessage,
    inFlight,
    compact,
  } = props;

  return (
    <View
      style={[styles.row, compact && styles.rowCompact]}
      accessibilityRole="summary"
    >
      <View style={[styles.item, compact && styles.itemCompact]}>
        <View
          style={[
            styles.dot,
            compact && styles.dotCompact,
            permissionGranted && cameraLive ? styles.dotOn : styles.dotOff,
          ]}
          accessibilityLabel={
            permissionGranted && cameraLive
              ? "Camera active"
              : "Camera not ready"
          }
        />
        <Text
          style={[
            styles.caption,
            compact && styles.captionCompact,
            styles.captionAfterDot,
          ]}
        >
          {permissionGranted && cameraLive ? "Camera on" : "Camera"}
        </Text>
      </View>
      <View style={[styles.item, compact && styles.itemCompact]}>
        <View
          style={[
            styles.dot,
            compact && styles.dotCompact,
            inFlight ? styles.dotBusy : styles.dotIdle,
          ]}
          accessibilityLabel={inFlight ? "Checking lane" : "Idle"}
        />
        <Text
          style={[
            styles.caption,
            compact && styles.captionCompact,
            styles.captionAfterDot,
          ]}
        >
          {inFlight ? "Checking…" : "Ready"}
        </Text>
      </View>
      <View style={[styles.item, compact && styles.itemCompact]}>
        <View
          style={[
            styles.dot,
            compact && styles.dotCompact,
            backendOk ? styles.dotOn : styles.dotWarn,
          ]}
          accessibilityLabel={
            backendOk ? "Service reachable" : "Service unavailable"
          }
        />
        <Text
          style={[
            styles.caption,
            compact && styles.captionCompact,
            styles.captionAfterDot,
          ]}
          numberOfLines={2}
        >
          {backendOk ? "Service OK" : "Service issue"}
        </Text>
      </View>
      {backendMessage && !backendOk ? (
        <Text
          style={[styles.errorNote, compact && styles.errorNoteCompact]}
          numberOfLines={5}
        >
          {backendMessage}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  rowCompact: {
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginBottom: 8,
  },
  itemCompact: {
    marginRight: 10,
    marginBottom: 4,
  },
  captionAfterDot: {
    marginLeft: 8,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#fff",
  },
  dotCompact: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
  },
  dotOn: {
    backgroundColor: "#8bc34a",
  },
  dotOff: {
    backgroundColor: "#616161",
  },
  dotBusy: {
    backgroundColor: "#ffd54f",
  },
  dotIdle: {
    backgroundColor: "#424242",
  },
  dotWarn: {
    backgroundColor: "#ff9800",
  },
  caption: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  captionCompact: {
    fontSize: 12,
    fontWeight: "600",
  },
  errorNote: {
    width: "100%",
    marginTop: 4,
    color: "#ffe082",
    fontSize: 16,
    lineHeight: 22,
  },
  errorNoteCompact: {
    fontSize: 12,
    lineHeight: 16,
  },
});
