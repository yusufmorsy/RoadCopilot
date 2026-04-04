import { StyleSheet, Text, View } from "react-native";

type Props = {
  cameraLive: boolean;
  permissionGranted: boolean;
  backendOk: boolean;
  backendMessage?: string | null;
  inFlight: boolean;
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
  } = props;

  return (
    <View style={styles.row} accessibilityRole="summary">
      <View style={styles.item}>
        <View
          style={[
            styles.dot,
            permissionGranted && cameraLive ? styles.dotOn : styles.dotOff,
          ]}
          accessibilityLabel={
            permissionGranted && cameraLive
              ? "Camera active"
              : "Camera not ready"
          }
        />
        <Text style={[styles.caption, styles.captionAfterDot]}>
          {permissionGranted && cameraLive ? "Camera on" : "Camera"}
        </Text>
      </View>
      <View style={styles.item}>
        <View
          style={[styles.dot, inFlight ? styles.dotBusy : styles.dotIdle]}
          accessibilityLabel={inFlight ? "Checking lane" : "Idle"}
        />
        <Text style={[styles.caption, styles.captionAfterDot]}>
          {inFlight ? "Checking…" : "Ready"}
        </Text>
      </View>
      <View style={styles.item}>
        <View
          style={[styles.dot, backendOk ? styles.dotOn : styles.dotWarn]}
          accessibilityLabel={
            backendOk ? "Service reachable" : "Service unavailable"
          }
        />
        <Text
          style={[styles.caption, styles.captionAfterDot]}
          numberOfLines={2}
        >
          {backendOk ? "Service OK" : "Service issue"}
        </Text>
      </View>
      {backendMessage && !backendOk ? (
        <Text style={styles.errorNote} numberOfLines={2}>
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
  item: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
    marginBottom: 8,
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
  errorNote: {
    width: "100%",
    marginTop: 4,
    color: "#ffe082",
    fontSize: 16,
    lineHeight: 22,
  },
});
