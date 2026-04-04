import type { RouteOption } from "@roadcopilot/contracts";
import React, { useCallback, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import type { LatLng } from "../../../services/googleRoutesClient";
import { coordinatesFromRouteOption, type MapCoordinate } from "../decodePolyline";
import { encodedPolylinesLookLikeSamePath } from "../safeRouteHeuristics";
import { mergeCoordinateLists, regionFromCoordinates } from "./mapRegion";

const COLOR_FASTEST = "#2563eb";
const COLOR_FASTEST_MUTED = "rgba(37, 99, 235, 0.4)";
const COLOR_SAFER = "#059669";
const COLOR_SAFER_MUTED = "rgba(5, 150, 105, 0.4)";
const COLOR_SAME = "#4b5563";

export type RouteComparisonMapProps = {
  origin: LatLng;
  destination: LatLng;
  options: RouteOption[];
  selectedId: string | null;
};

export function RouteComparisonMap({
  origin,
  destination,
  options,
  selectedId,
}: RouteComparisonMapProps): React.ReactElement {
  const mapRef = useRef<React.ElementRef<typeof MapView>>(null);

  const fastest = useMemo(() => options.find((o) => o.id === "fastest"), [options]);
  const safer = useMemo(() => options.find((o) => o.id === "safer"), [options]);

  const coordsFastest = useMemo(
    () => (fastest ? coordinatesFromRouteOption(fastest) : []),
    [fastest]
  );
  const coordsSafer = useMemo(() => (safer ? coordinatesFromRouteOption(safer) : []), [safer]);

  const samePath = useMemo(() => {
    if (!fastest || !safer) return false;
    if (fastest.geometry.format !== "polyline" || safer.geometry.format !== "polyline") {
      return fastest.geometry.data === safer.geometry.data;
    }
    return encodedPolylinesLookLikeSamePath(fastest.geometry.data, safer.geometry.data);
  }, [fastest, safer]);

  const fitPoints = useMemo(() => {
    const lists: MapCoordinate[][] = [];
    if (coordsFastest.length) lists.push(coordsFastest);
    if (!samePath && coordsSafer.length) lists.push(coordsSafer);
    const merged = mergeCoordinateLists(lists);
    return [
      { latitude: origin.latitude, longitude: origin.longitude },
      { latitude: destination.latitude, longitude: destination.longitude },
      ...merged,
    ];
  }, [coordsFastest, coordsSafer, destination, origin, samePath]);

  const initialRegion = useMemo(() => regionFromCoordinates(fitPoints), [fitPoints]);

  const fitMap = useCallback(() => {
    if (fitPoints.length < 2) return;
    mapRef.current?.fitToCoordinates(fitPoints, {
      edgePadding: { top: 28, right: 24, bottom: 24, left: 24 },
      animated: false,
    });
  }, [fitPoints]);

  if (!initialRegion) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>Route preview is not available for this destination.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} accessibilityLabel="Route preview map comparing options">
      <Text style={styles.caption}>Route preview</Text>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        onMapReady={fitMap}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <Marker
          coordinate={origin}
          title="Start"
          description="Approximate starting point for this preview."
        />
        <Marker
          coordinate={destination}
          title="Destination"
          description="Where you are headed."
        />
        {samePath && coordsFastest.length > 0 ? (
          <Polyline
            coordinates={coordsFastest}
            strokeColor={COLOR_SAME}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        ) : (
          <>
            {coordsFastest.length > 0 ? (
              <Polyline
                coordinates={coordsFastest}
                strokeColor={selectedId === "fastest" ? COLOR_FASTEST : COLOR_FASTEST_MUTED}
                strokeWidth={selectedId === "fastest" ? 6 : 3}
                lineCap="round"
                lineJoin="round"
                zIndex={selectedId === "fastest" ? 2 : 1}
              />
            ) : null}
            {coordsSafer.length > 0 ? (
              <Polyline
                coordinates={coordsSafer}
                strokeColor={selectedId === "safer" ? COLOR_SAFER : COLOR_SAFER_MUTED}
                strokeWidth={selectedId === "safer" ? 6 : 3}
                lineCap="round"
                lineJoin="round"
                zIndex={selectedId === "safer" ? 2 : 1}
              />
            ) : null}
          </>
        )}
      </MapView>

      {samePath ? (
        <Text style={styles.samePathNote}>
          For this trip, both choices follow the same path — compare time and comfort in the cards
          below.
        </Text>
      ) : null}

      <View style={styles.legend}>
        {samePath ? (
          <View style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: COLOR_SAME }]} />
            <Text style={styles.legendText}>Shared path</Text>
          </View>
        ) : (
          <>
            <View style={styles.legendRow}>
              <View style={[styles.swatch, { backgroundColor: COLOR_FASTEST }]} />
              <Text style={styles.legendText}>Fastest</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.swatch, { backgroundColor: COLOR_SAFER }]} />
              <Text style={styles.legendText}>Calmer route</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  caption: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 8,
  },
  map: {
    width: "100%",
    height: 280,
    borderRadius: 12,
    overflow: "hidden",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginTop: 10,
    paddingHorizontal: 2,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  swatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 14,
    color: "#374151",
  },
  samePathNote: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    color: "#4b5563",
  },
  fallback: {
    height: 120,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    marginBottom: 12,
  },
  fallbackText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
});
