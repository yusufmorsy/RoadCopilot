import type { AnalyzeFrameResponse, TripEvent } from "@roadcopilot/contracts";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useFrameCapture } from "../../hooks/useFrameCapture";
import { useLaneAlerts } from "../../hooks/useLaneAlerts";
import { newTripEventId } from "../sensors/newTripEventId";
import {
  getVisionApiBaseUrl,
  isVisionApiConfigured,
  type AnalyzeFrameOutcome,
} from "../../services/visionClient";
import { VisionStatusBar } from "./components/VisionStatusBar";
import {
  laneResponseToUiState,
  laneStatusLabel,
} from "./laneStatus";

const FRAME_INTERVAL_MS = 650;

export type TripLaneLogBinding = {
  isActive: boolean;
  tripId: string | null;
  addTripEvent: (event: TripEvent) => void;
};

export type LaneDriveScreenProps = {
  /** When set, spoken drift advisories also append a {@link TripEvent} for the family timeline. */
  tripLaneLog?: TripLaneLogBinding;
  /** When false, drift voice cues are off (e.g. no active trip). Defaults to true. */
  laneAdvisoryEnabled?: boolean;
};

export function LaneDriveScreen({
  tripLaneLog,
  laneAdvisoryEnabled = true,
}: LaneDriveScreenProps = {}) {
  const visionReady = isVisionApiConfigured();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [latestResponse, setLatestResponse] =
    useState<AnalyzeFrameResponse | null>(null);
  const [backendOk, setBackendOk] = useState(true);
  const [backendDetail, setBackendDetail] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(false);

  const laneUi = useMemo(
    () => laneResponseToUiState(latestResponse),
    [latestResponse]
  );

  const laneAlertsOn =
    laneAdvisoryEnabled && permission?.granted === true && cameraReady;

  const onDriftAdvisory = useCallback(
    (direction: "left" | "right") => {
      if (!tripLaneLog?.isActive || !tripLaneLog.tripId) return;
      tripLaneLog.addTripEvent({
        id: newTripEventId(),
        tripId: tripLaneLog.tripId,
        type: "lane_drift_advisory",
        occurredAt: new Date().toISOString(),
        severity: "low",
        description:
          direction === "left"
            ? "Lane position eased a little left — a gentle centering cue."
            : "Lane position eased a little right — a gentle centering cue.",
      });
    },
    [tripLaneLog]
  );

  useLaneAlerts(laneUi.status, laneAlertsOn, {
    onDriftAdvisory: tripLaneLog ? onDriftAdvisory : undefined,
  });

  const captureFrame = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam) return null;
    const pic = await cam.takePictureAsync({
      base64: true,
      quality: 0.42,
      skipProcessing: false,
    });
    if (!pic?.base64) return null;
    return {
      base64: pic.base64,
      width: pic.width,
      height: pic.height,
    };
  }, []);

  const onOutcome = useCallback((outcome: AnalyzeFrameOutcome) => {
      if (outcome.ok) {
        setLatestResponse(outcome.data);
        setBackendOk(true);
        setBackendDetail(null);
        return;
      }
      setBackendOk(false);
      setBackendDetail(outcome.message);
    },
    []
  );

  useFrameCapture({
    enabled: permission?.granted === true && visionReady,
    cameraReady,
    intervalMs: FRAME_INTERVAL_MS,
    captureFrame,
    onOutcome,
    onInFlightChange: setInFlight,
  });

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1a237e" />
        <Text style={styles.body}>Checking camera permission…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Camera</Text>
        <Text style={styles.body}>
          RoadCopilot uses the back camera to gently read lane position. Nothing
          is recorded unless you choose to save a trip later.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => void requestPermission()}
          accessibilityRole="button"
          accessibilityLabel="Allow camera access"
        >
          <Text style={styles.primaryButtonText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        mode="picture"
        onCameraReady={() => setCameraReady(true)}
        onMountError={(event) => {
          setBackendOk(false);
          setBackendDetail(event.message);
        }}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <Text style={styles.heading}>Road view</Text>
        <VisionStatusBar
          cameraLive={cameraReady}
          permissionGranted
          backendOk={visionReady && backendOk}
          backendMessage={
            visionReady ? backendDetail : "Set EXPO_PUBLIC_VISION_API_URL in apps/mobile/.env"
          }
          inFlight={visionReady && inFlight}
        />
        {!visionReady ? (
          <Text style={styles.configBanner}>
            Lane analysis needs a vision server URL. Add EXPO_PUBLIC_VISION_API_URL to apps/mobile/.env
            (see .env.example), then restart Expo.
          </Text>
        ) : null}
        <View style={styles.laneCard}>
          <Text style={styles.laneTitle}>Lane position</Text>
          <Text style={styles.laneValue} accessibilityLiveRegion="polite">
            {laneStatusLabel(laneUi.status)}
          </Text>
          <Text style={styles.laneMeta}>
            {laneUi.detected
              ? `Confidence ${Math.round(laneUi.confidence * 100)}%`
              : "Waiting for clear lane lines"}
          </Text>
          {laneUi.offsetNorm !== undefined ? (
            <Text style={styles.laneMeta}>
              Offset {laneUi.offsetNorm > 0 ? "right" : "left"} (
              {laneUi.offsetNorm.toFixed(2)})
            </Text>
          ) : null}
          {latestResponse?.advisory?.message ? (
            <Text style={styles.advisory}>{latestResponse.advisory.message}</Text>
          ) : null}
        </View>
        {__DEV__ && visionReady ? (
          <Text style={styles.hint}>Vision API: {getVisionApiBaseUrl()}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 20,
    paddingBottom: 36,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  heading: {
    position: "absolute",
    top: 56,
    left: 20,
    right: 20,
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  laneCard: {
    backgroundColor: "rgba(10,10,10,0.92)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "#fff",
  },
  laneTitle: {
    color: "#e0e0e0",
    fontSize: 18,
    marginBottom: 8,
    fontWeight: "600",
  },
  laneValue: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 8,
  },
  laneMeta: {
    color: "#e0e0e0",
    fontSize: 20,
    lineHeight: 28,
  },
  advisory: {
    marginTop: 14,
    color: "#fff9c4",
    fontSize: 18,
    lineHeight: 26,
  },
  configBanner: {
    backgroundColor: "rgba(80, 50, 0, 0.92)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    color: "#fff3e0",
    fontSize: 16,
    lineHeight: 24,
    borderWidth: 1,
    borderColor: "#ffb74d",
  },
  hint: {
    marginTop: 12,
    color: "#bdbdbd",
    fontSize: 14,
  },
  centered: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 16,
    color: "#1a1a1a",
  },
  body: {
    fontSize: 20,
    lineHeight: 30,
    textAlign: "center",
    color: "#222",
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: "#1a237e",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 220,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
});
