import type { AnalyzeFrameResponse, TripEvent } from "@roadcopilot/contracts";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { agentDebugLog } from "../../debug/agentDebugLog";
import {
  logRoadCopilotVision,
  serializeUnknownError,
} from "../../debug/visionCaptureDiagnostics";
import {
  type AnalyzeFrameOutcomeContext,
  useFrameCapture,
} from "../../hooks/useFrameCapture";
import { useLaneAlerts } from "../../hooks/useLaneAlerts";
import { newTripEventId } from "../sensors/newTripEventId";
import {
  getVisionApiBaseUrl,
  isVisionApiConfigured,
  type AnalyzeFrameOutcome,
} from "../../services/visionClient";
import { LaneAnalysisOverlay } from "./components/LaneAnalysisOverlay";
import { VisionStatusBar } from "./components/VisionStatusBar";
import type { LaneDisplayStatus } from "./laneStatus";
import {
  laneResponseToUiState,
  laneStatusDriverLabel,
  laneStatusLabel,
} from "./laneStatus";

/** How often to repeat the same lane result in dev logs (ms) when status is unchanged. */
const LANE_LOG_SNAPSHOT_INTERVAL_MS = 4000;

/**
 * After each full cycle (photo + upload + response), wait this long before the next photo.
 */
const FRAME_INTERVAL_MS = 750;

/** Largest edge in px for stills used for lane API (smaller than full sensor = faster upload). */
const MAX_ANALYSIS_PICTURE_SIDE_PX = 1280;

/**
 * After changing `pictureSize` on Android, native needs a short moment before capture works.
 * iOS skips numeric `pictureSize` so we avoid a long settle wait and capture failures; JPEG quality
 * limits upload size instead.
 */
const PICTURE_SIZE_SETTLE_MS = Platform.OS === "android" ? 200 : 0;

/** Slightly stronger compression on iOS where we do not lock a WxH preset. */
const CAPTURE_JPEG_QUALITY = Platform.OS === "ios" ? 0.26 : 0.36;

/**
 * `onCameraReady` can fire before AVCapturePhotoOutput reliably accepts stills; without a short wait,
 * iOS often fails immediately with "Image could not be captured" (AVFoundation error → generic message).
 */
const IOS_STILL_CAPTURE_PRIMING_MS = 800;

const IOS_CAPTURE_RETRY_AFTER_MS = 450;

function pickLaneAnalysisPictureSize(
  sizes: string[],
  maxSide: number
): string | undefined {
  const parsed = sizes
    .map((s) => {
      const m = /^(\d+)x(\d+)$/.exec(s.trim());
      if (!m) return null;
      const w = Number(m[1]);
      const h = Number(m[2]);
      if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
      return { token: s, max: Math.max(w, h), area: w * h };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  if (parsed.length === 0) return undefined;

  const fitting = parsed
    .filter((p) => p.max <= maxSide)
    .sort((a, b) => b.area - a.area)[0];
  if (fitting) return fitting.token;

  return parsed.sort((a, b) => a.area - b.area)[0]?.token;
}

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
  /** `compact` = small embedded strip (e.g. under a map); `fullscreen` = full-screen camera. */
  layout?: "fullscreen" | "compact";
  /** Fires when lane UI status changes (e.g. for route voice gating). */
  onLaneStatusChange?: (status: LaneDisplayStatus) => void;
};

export function LaneDriveScreen({
  tripLaneLog,
  laneAdvisoryEnabled = true,
  layout = "fullscreen",
  onLaneStatusChange,
}: LaneDriveScreenProps = {}) {
  const compact = layout === "compact";
  const visionReady = isVisionApiConfigured();
  const cameraRef = useRef<CameraView>(null);
  const pictureProbeFinishTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  /** True after we finish probing picture sizes so the first frame is not a full-sensor giant JPEG. */
  const [pictureSizeProbeDone, setPictureSizeProbeDone] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>();
  const [latestResponse, setLatestResponse] =
    useState<AnalyzeFrameResponse | null>(null);
  /** JPEG dimensions for the frame that produced the current `latestResponse` (overlay mapping). */
  const [analysisCaptureSize, setAnalysisCaptureSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });
  const [backendOk, setBackendOk] = useState(true);
  const [backendDetail, setBackendDetail] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(false);

  const laneUi = useMemo(
    () => laneResponseToUiState(latestResponse),
    [latestResponse]
  );

  const prevLaneStatusRef = useRef<LaneDisplayStatus | null>(null);
  const lastLaneLogAtRef = useRef(0);

  useEffect(() => {
    onLaneStatusChange?.(laneUi.status);
  }, [laneUi.status, onLaneStatusChange]);

  useEffect(() => {
    if (!__DEV__ || !visionReady || !latestResponse) return;
    const now = Date.now();
    const statusChanged = prevLaneStatusRef.current !== laneUi.status;
    prevLaneStatusRef.current = laneUi.status;
    const periodic =
      now - lastLaneLogAtRef.current >= LANE_LOG_SNAPSHOT_INTERVAL_MS;
    if (!statusChanged && !periodic) return;
    lastLaneLogAtRef.current = now;
    logRoadCopilotVision(
      statusChanged ? "lane_analysis_status_change" : "lane_analysis_snapshot",
      {
        result: laneStatusDriverLabel(laneUi.status),
        status: laneUi.status,
        detected: laneUi.detected,
        confidence: Number(laneUi.confidence.toFixed(2)),
        offsetNorm:
          laneUi.offsetNorm === undefined ? null : Number(laneUi.offsetNorm.toFixed(3)),
      }
    );
  }, [visionReady, latestResponse, laneUi]);

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

  useEffect(() => {
    return () => {
      if (pictureProbeFinishTimerRef.current !== null) {
        clearTimeout(pictureProbeFinishTimerRef.current);
        pictureProbeFinishTimerRef.current = null;
      }
    };
  }, []);

  const autoCameraRequestRef = useRef(false);

  // When status is still `undetermined`, nothing is wrong yet — but iOS only shows the system sheet
  // after the native permission API runs. Request once on mount so drivers are not stuck behind an
  // extra in-app tap (and logs stay on `undetermined` / `permissionGranted: false` until they answer).
  useEffect(() => {
    if (!permission || permission.granted) return;
    const st =
      typeof permission === "object" && "status" in permission
        ? (permission as { status?: string }).status
        : undefined;
    if (st !== "undetermined") return;
    if (autoCameraRequestRef.current) return;
    autoCameraRequestRef.current = true;
    void (async () => {
      try {
        await requestPermission();
      } catch (e) {
        autoCameraRequestRef.current = false;
        logRoadCopilotVision("lane_camera_auto_request_failed", serializeUnknownError(e));
      }
    })();
  }, [permission, requestPermission]);

  const frameLoopEnabled =
    permission?.granted === true && visionReady && pictureSizeProbeDone;

  useEffect(() => {
    agentDebugLog(
      "LaneDriveScreen.tsx:permission_effect",
      "permission_snapshot",
      "H1",
      {
        permissionIsNull: permission == null,
        granted: permission?.granted ?? null,
        status:
          permission && typeof permission === "object" && "status" in permission
            ? String((permission as { status?: string }).status)
            : null,
        canAskAgain:
          permission &&
          typeof permission === "object" &&
          "canAskAgain" in permission
            ? Boolean((permission as { canAskAgain?: boolean }).canAskAgain)
            : null,
      }
    );
  }, [permission]);

  useEffect(() => {
    logRoadCopilotVision("lane_drive_capture_gates", {
      visionUrlConfigured: visionReady,
      visionBasePreview: getVisionApiBaseUrl()?.slice(0, 36) ?? null,
      permissionGranted: permission?.granted === true,
      pictureSizeProbeDone,
      cameraReady,
      frameLoopEnabled,
      cameraAndLoopReady: frameLoopEnabled && cameraReady,
    });
  }, [
    visionReady,
    permission?.granted,
    pictureSizeProbeDone,
    cameraReady,
    frameLoopEnabled,
  ]);

  const handleCameraReady = useCallback(() => {
    agentDebugLog(
      "LaneDriveScreen.tsx:handleCameraReady",
      "onCameraReady_fired",
      "H3",
      { compact, platform: Platform.OS }
    );
    setCameraReady(true);
    setPictureSizeProbeDone(false);
    if (pictureProbeFinishTimerRef.current !== null) {
      clearTimeout(pictureProbeFinishTimerRef.current);
      pictureProbeFinishTimerRef.current = null;
    }
    const cam = cameraRef.current;
    const finishProbe = () => setPictureSizeProbeDone(true);
    if (!cam) {
      finishProbe();
      return;
    }
    void (async () => {
      let picked: string | undefined;
      try {
        if (Platform.OS === "ios") {
          setPictureSize(undefined);
          logRoadCopilotVision("lane_ios_session_priming", {
            waitMs: IOS_STILL_CAPTURE_PRIMING_MS,
            note: "Delay before first still — AVCaptureSession often is not ready the instant onCameraReady fires",
            jpegQuality: CAPTURE_JPEG_QUALITY,
          });
          pictureProbeFinishTimerRef.current = setTimeout(() => {
            pictureProbeFinishTimerRef.current = null;
            logRoadCopilotVision("lane_ios_session_priming_done", {
              waitedMs: IOS_STILL_CAPTURE_PRIMING_MS,
              note: "pictureSizeProbeDone → true; frame loop may arm if vision URL set",
            });
            finishProbe();
          }, IOS_STILL_CAPTURE_PRIMING_MS);
          return;
        }

        const sizes = await cam.getAvailablePictureSizesAsync();
        picked = pickLaneAnalysisPictureSize(sizes, MAX_ANALYSIS_PICTURE_SIDE_PX);
        if (picked) setPictureSize(picked);
        logRoadCopilotVision("lane_picture_sizes_probe", {
          sizeCount: sizes.length,
          picked: picked ?? null,
          sampleSizes: sizes.slice(0, 12),
          maxSideCap: MAX_ANALYSIS_PICTURE_SIDE_PX,
        });
      } catch (e) {
        logRoadCopilotVision("lane_picture_sizes_probe_failed", {
          ...serializeUnknownError(e),
        });
      } finally {
        if (Platform.OS !== "ios") {
          const settleMs = picked ? PICTURE_SIZE_SETTLE_MS : 0;
          if (settleMs > 0) {
            logRoadCopilotVision("lane_picture_sizes_settling", {
              waitMs: settleMs,
              picked,
            });
            pictureProbeFinishTimerRef.current = setTimeout(() => {
              pictureProbeFinishTimerRef.current = null;
              finishProbe();
            }, settleMs);
          } else {
            finishProbe();
          }
        }
      }
    })();
  }, []);

  const captureFrame = useCallback(async () => {
    const cam = cameraRef.current;
    if (!cam) {
      logRoadCopilotVision("lane_capture_skipped", { reason: "no_camera_ref" });
      return null;
    }
    const pictureOptions = {
      base64: true as const,
      quality: CAPTURE_JPEG_QUALITY,
      skipProcessing: false,
      shutterSound: false,
    };

    const takeOnce = () => cam.takePictureAsync(pictureOptions);

    let pic: Awaited<ReturnType<typeof takeOnce>>;
    try {
      pic = await takeOnce();
    } catch (firstErr) {
      const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      const retriableIos =
        Platform.OS === "ios" &&
        msg.toLowerCase().includes("could not be captured");
      if (retriableIos) {
        logRoadCopilotVision("lane_take_picture_ios_retry", {
          waitMs: IOS_CAPTURE_RETRY_AFTER_MS,
          firstError: msg.slice(0, 200),
        });
        await new Promise((r) => setTimeout(r, IOS_CAPTURE_RETRY_AFTER_MS));
        try {
          pic = await takeOnce();
        } catch (e) {
          logRoadCopilotVision("lane_take_picture_failed", {
            pictureSize: pictureSize ?? null,
            quality: CAPTURE_JPEG_QUALITY,
            skipProcessing: false,
            phase: "after_ios_retry",
            ...serializeUnknownError(e),
          });
          throw e;
        }
      } else {
        logRoadCopilotVision("lane_take_picture_failed", {
          pictureSize: pictureSize ?? null,
          quality: CAPTURE_JPEG_QUALITY,
          skipProcessing: false,
          ...serializeUnknownError(firstErr),
        });
        throw firstErr;
      }
    }

    if (!pic?.base64) {
      logRoadCopilotVision("lane_capture_no_base64", {
        pictureSize: pictureSize ?? null,
        hasUri: Boolean(pic?.uri),
        width: pic?.width ?? null,
        height: pic?.height ?? null,
      });
      return null;
    }
    return {
      base64: pic.base64,
      width: pic.width,
      height: pic.height,
    };
  }, [pictureSize]);

  const onOutcome = useCallback(
    (outcome: AnalyzeFrameOutcome, context?: AnalyzeFrameOutcomeContext) => {
      if (outcome.ok) {
        setLatestResponse(outcome.data);
        setBackendOk(true);
        setBackendDetail(null);
        const cw = context?.capture.width;
        const ch = context?.capture.height;
        if (
          typeof cw === "number" &&
          typeof ch === "number" &&
          cw > 0 &&
          ch > 0
        ) {
          setAnalysisCaptureSize({ width: cw, height: ch });
        }
        return;
      }
      setBackendOk(false);
      setBackendDetail(outcome.message);
    },
    []
  );

  useFrameCapture({
    enabled: frameLoopEnabled,
    cameraReady,
    intervalMs: FRAME_INTERVAL_MS,
    captureFrame,
    onOutcome,
    onInFlightChange: setInFlight,
  });

  const permissionGateStyle = compact ? styles.centeredInStrip : styles.centered;

  if (!permission) {
    return (
      <View style={permissionGateStyle}>
        <ActivityIndicator size="large" color="#1a237e" />
        <Text style={compact ? styles.bodyCompact : styles.body}>
          Checking camera permission…
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    const canAskAgain =
      "canAskAgain" in permission ? Boolean(permission.canAskAgain) : true;
    return (
      <View style={permissionGateStyle}>
        <Text style={compact ? styles.titleCompact : styles.title}>Camera</Text>
        <Text style={compact ? styles.bodyCompact : styles.body}>
          RoadCopilot uses the back camera to gently read lane position. Nothing
          is recorded unless you choose to save a trip later.
        </Text>
        {canAskAgain ? (
          <Pressable
            style={compact ? styles.primaryButtonCompact : styles.primaryButton}
            onPress={() => {
              void (async () => {
                agentDebugLog(
                  "LaneDriveScreen.tsx:requestPermission",
                  "before_requestPermission",
                  "H1",
                  {}
                );
                try {
                  const result = await requestPermission();
                  agentDebugLog(
                    "LaneDriveScreen.tsx:requestPermission",
                    "after_requestPermission",
                    "H1",
                    {
                      granted: result?.granted ?? null,
                      status:
                        result &&
                        typeof result === "object" &&
                        "status" in result
                          ? String((result as { status?: string }).status)
                          : null,
                    }
                  );
                } catch (e) {
                  agentDebugLog(
                    "LaneDriveScreen.tsx:requestPermission",
                    "requestPermission_threw",
                    "H1",
                    serializeUnknownError(e)
                  );
                }
              })();
            }}
            accessibilityRole="button"
            accessibilityLabel="Allow camera access"
          >
            <Text
              style={
                compact ? styles.primaryButtonTextCompact : styles.primaryButtonText
              }
            >
              Allow camera
            </Text>
          </Pressable>
        ) : (
          <Text style={compact ? styles.bodyCompact : styles.body}>
            Camera access was turned off for RoadCopilot. Enable it in Settings to use lane
            awareness.
          </Text>
        )}
        {!canAskAgain ? (
          <Pressable
            style={[
              compact ? styles.secondaryButtonCompact : styles.secondaryButton,
              { marginTop: 12 },
            ]}
            onPress={() => {
              void Linking.openSettings();
            }}
            accessibilityRole="button"
            accessibilityLabel="Open app settings"
          >
            <Text
              style={
                compact
                  ? styles.secondaryButtonTextCompact
                  : styles.secondaryButtonText
              }
            >
              Open Settings
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.root, compact && styles.rootCompact]}>
      <View
        style={compact ? styles.cameraStrip : styles.camera}
        collapsable={Platform.OS === "android" ? false : undefined}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          agentDebugLog(
            "LaneDriveScreen.tsx:camera_onLayout",
            "camera_container_layout",
            "H4",
            { width, height, compact }
          );
          setCameraLayout({ width, height });
        }}
      >
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          facing="back"
          mode="picture"
          {...(pictureSize ? { pictureSize } : {})}
          onCameraReady={handleCameraReady}
          onMountError={(event) => {
            agentDebugLog(
              "LaneDriveScreen.tsx:onMountError",
              "camera_mount_error",
              "H2",
              { message: event.message?.slice(0, 220) ?? null }
            );
            logRoadCopilotVision("lane_camera_mount_error", {
              message: event.message?.slice(0, 400),
            });
            setBackendOk(false);
            setBackendDetail(event.message);
          }}
        />
        {visionReady && analysisCaptureSize ? (
          <LaneAnalysisOverlay
            overlay={latestResponse?.lane.overlay}
            captureWidth={analysisCaptureSize.width}
            captureHeight={analysisCaptureSize.height}
            layoutWidth={cameraLayout.width}
            layoutHeight={cameraLayout.height}
          />
        ) : null}
      </View>
      <View style={[styles.overlay, compact && styles.overlayCompact]} pointerEvents="box-none">
        {compact ? (
          <Text style={styles.headingCompact}>Road view</Text>
        ) : (
          <Text style={styles.heading}>Road view</Text>
        )}
        {!visionReady ? (
          <Text style={[styles.configBanner, compact && styles.configBannerCompact]}>
            Lane analysis needs a vision server URL. Add EXPO_PUBLIC_VISION_API_URL to apps/mobile/.env
            (see .env.example), then restart Expo.
          </Text>
        ) : null}
        {(() => {
          const laneCardEl = (
            <View style={[styles.laneCard, compact && styles.laneCardCompact]} key="lane-card">
              <Text style={[styles.laneTitle, compact && styles.laneTitleCompact]}>Lane analysis</Text>
              <Text
                style={[styles.laneValue, compact && styles.laneValueCompact]}
                accessibilityRole="header"
                accessibilityLiveRegion="polite"
              >
                {laneStatusDriverLabel(laneUi.status)}
              </Text>
              <Text style={[styles.laneMeta, compact && styles.laneMetaCompact]}>
                {laneStatusLabel(laneUi.status)}
                {" · "}
                {laneUi.detected
                  ? `confidence ${Math.round(laneUi.confidence * 100)}%`
                  : "no clear lane read this frame"}
              </Text>
              {laneUi.offsetNorm !== undefined ? (
                <Text style={[styles.laneMeta, compact && styles.laneMetaCompact]}>
                  Lateral offset {laneUi.offsetNorm > 0 ? "right" : "left"} of center (
                  {laneUi.offsetNorm.toFixed(2)})
                </Text>
              ) : null}
              {latestResponse?.advisory?.message ? (
                <Text
                  style={[styles.advisory, compact && styles.advisoryCompact]}
                  numberOfLines={compact ? 4 : undefined}
                >
                  {latestResponse.advisory.message}
                </Text>
              ) : null}
            </View>
          );
          const statusEl = (
            <VisionStatusBar
              key="vision-status"
              cameraLive={cameraReady}
              permissionGranted
              backendOk={visionReady && backendOk}
              backendMessage={
                visionReady ? backendDetail : "Set EXPO_PUBLIC_VISION_API_URL in apps/mobile/.env"
              }
              inFlight={visionReady && inFlight}
              compact={compact}
            />
          );
          /* Fullscreen: flex-end stacks last child toward bottom — keep status above lane card. */
          return compact ? (
            <>
              {laneCardEl}
              {statusEl}
            </>
          ) : (
            <>
              {statusEl}
              {laneCardEl}
            </>
          );
        })()}
        {__DEV__ && visionReady ? (
          <Text style={[styles.hint, compact && styles.hintCompact]}>
            Vision API: {getVisionApiBaseUrl()}
          </Text>
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
  rootCompact: {
    flex: 0,
    width: "100%",
    minHeight: 200,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  /** Fullscreen drive: fill under the semi-transparent HUD. */
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  /**
   * Embedded strip under the map — must not merge with `absoluteFillObject` (left/top/right/bottom),
   * or Android Yoga can resolve conflicting constraints and the preview never paints.
   */
  cameraStrip: {
    position: "relative",
    width: "100%",
    height: 112,
    overflow: "hidden",
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 20,
    paddingBottom: 36,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  overlayCompact: {
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: "flex-start",
    padding: 12,
    paddingBottom: 14,
    backgroundColor: "rgba(0,0,0,0.88)",
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
  headingCompact: {
    color: "#e5e7eb",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  laneCard: {
    backgroundColor: "rgba(10,10,10,0.92)",
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: "#fff",
  },
  laneCardCompact: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    marginTop: 8,
  },
  laneTitle: {
    color: "#e0e0e0",
    fontSize: 18,
    marginBottom: 8,
    fontWeight: "600",
  },
  laneTitleCompact: {
    fontSize: 13,
    marginBottom: 4,
  },
  laneValue: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 8,
  },
  laneValueCompact: {
    fontSize: 22,
    marginBottom: 4,
  },
  laneMeta: {
    color: "#e0e0e0",
    fontSize: 20,
    lineHeight: 28,
  },
  laneMetaCompact: {
    fontSize: 14,
    lineHeight: 20,
  },
  advisory: {
    marginTop: 14,
    color: "#fff9c4",
    fontSize: 18,
    lineHeight: 26,
  },
  advisoryCompact: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
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
  configBannerCompact: {
    padding: 10,
    marginBottom: 8,
    fontSize: 13,
    lineHeight: 18,
  },
  hint: {
    marginTop: 12,
    color: "#bdbdbd",
    fontSize: 14,
  },
  hintCompact: {
    marginTop: 6,
    fontSize: 11,
  },
  centered: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  /**
   * Embedded under the map: parent `lanePane` has no fixed height. `flex: 1` alone collapses to
   * zero here, so the system permission prompt never appears. Keep a minimum height so the gate
   * UI and `requestPermission()` path stay reachable.
   */
  centeredInStrip: {
    width: "100%",
    minHeight: 240,
    flexGrow: 1,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 16,
    color: "#1a1a1a",
  },
  titleCompact: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
    color: "#1a1a1a",
    textAlign: "center",
  },
  body: {
    fontSize: 20,
    lineHeight: 30,
    textAlign: "center",
    color: "#222",
    marginBottom: 24,
  },
  bodyCompact: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    color: "#222",
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: "#1a237e",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 220,
    alignItems: "center",
  },
  primaryButtonCompact: {
    backgroundColor: "#1a237e",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    minWidth: 180,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  primaryButtonTextCompact: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#1a237e",
    minWidth: 220,
    alignItems: "center",
  },
  secondaryButtonCompact: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#1a237e",
    minWidth: 180,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#1a237e",
    fontSize: 18,
    fontWeight: "700",
  },
  secondaryButtonTextCompact: {
    color: "#1a237e",
    fontSize: 15,
    fontWeight: "700",
  },
});
