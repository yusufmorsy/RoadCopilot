import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

import type { RouteOption } from "@roadcopilot/contracts";

import type { LatLng } from "../../../services/googleRoutesClient";
import { coordinatesFromRouteOption, type MapCoordinate } from "../decodePolyline";
import { regionFromCoordinates } from "./mapRegion";

const ROUTE_COLOR = "#1d4ed8";

/** Zoom level for follow mode (Google Maps); iOS also accepts zoom in animateCamera. */
const NAV_ZOOM = 17;
const THROTTLE_MS = 1100;
const MIN_MOVE_METERS = 5;
const MIN_SPEED_MPS_FOR_HEADING = 1.2;

function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6_371_000;
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export type ActiveRouteMapProps = {
  origin: LatLng;
  destination: LatLng;
  selectedRoute: RouteOption;
  /** When true, requests foreground location and shows the device on the map when allowed. */
  showsUserLocation?: boolean;
  /**
   * When true (default), map follows GPS with heading and driving-style zoom like Apple/Google Maps.
   * When false, shows a static overview fit to the route.
   */
  navigationStyle?: boolean;
  /** Insets so the route and user stay clear of UI chrome (lane strip, top bar). */
  mapPadding?: { top: number; right: number; bottom: number; left: number };
};

const DEFAULT_TRIP_PADDING = {
  top: 88,
  right: 12,
  bottom: 220,
  left: 12,
};

export function ActiveRouteMap({
  origin,
  destination,
  selectedRoute,
  showsUserLocation = true,
  navigationStyle = true,
  mapPadding = DEFAULT_TRIP_PADDING,
}: ActiveRouteMapProps): React.ReactElement {
  const mapRef = useRef<React.ElementRef<typeof MapView>>(null);
  const [userLocationOk, setUserLocationOk] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const lastCameraRef = useRef<{
    t: number;
    lat: number;
    lng: number;
    heading: number;
  }>({ t: 0, lat: 0, lng: 0, heading: 0 });

  useEffect(() => {
    if (!showsUserLocation) {
      setUserLocationOk(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!cancelled) setUserLocationOk(status === "granted");
    })();
    return () => {
      cancelled = true;
    };
  }, [showsUserLocation]);

  const routeCoords = useMemo<MapCoordinate[]>(
    () => coordinatesFromRouteOption(selectedRoute),
    [selectedRoute]
  );

  const fitPoints = useMemo(
    () => [
      { latitude: origin.latitude, longitude: origin.longitude },
      { latitude: destination.latitude, longitude: destination.longitude },
      ...routeCoords,
    ],
    [destination, origin, routeCoords]
  );

  const initialRegion = useMemo(() => regionFromCoordinates(fitPoints), [fitPoints]);

  const fitOverview = useCallback(() => {
    if (fitPoints.length < 2 || !mapRef.current) return;
    mapRef.current.fitToCoordinates(fitPoints, {
      edgePadding: mapPadding,
      animated: false,
    });
  }, [fitPoints, mapPadding]);

  const onMapReady = useCallback(() => {
    setMapReady(true);
    if (!navigationStyle || !showsUserLocation) {
      fitOverview();
      return;
    }
    // Brief overview, then GPS updates take over when fixes arrive.
    fitOverview();
  }, [fitOverview, navigationStyle, showsUserLocation]);

  // Dynamic follow-the-user camera (both platforms; followsUserLocation is iOS-only).
  useEffect(() => {
    if (!navigationStyle || !showsUserLocation || !userLocationOk || !mapReady) {
      return;
    }

    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;

    const applyCamera = (
      latitude: number,
      longitude: number,
      headingDeg: number
    ) => {
      const map = mapRef.current;
      if (!map) return;

      const cam: {
        center: LatLng;
        pitch: number;
        heading: number;
        zoom?: number;
        altitude?: number;
      } = {
        center: { latitude, longitude },
        pitch: 0,
        heading: headingDeg,
      };

      if (Platform.OS === "ios") {
        cam.altitude = 650;
      } else {
        cam.zoom = NAV_ZOOM;
      }

      map.animateCamera(cam, { duration: 480 });
    };

    void (async () => {
      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 900,
          distanceInterval: 6,
        },
        (loc) => {
          if (cancelled) return;
          const acc = loc.coords.accuracy;
          if (acc != null && acc > 90) return;

          const { latitude, longitude, heading, speed } = loc.coords;
          const now = Date.now();
          const last = lastCameraRef.current;
          const moved =
            last.t === 0 ||
            haversineMeters(
              { latitude, longitude },
              { latitude: last.lat, longitude: last.lng }
            ) >= MIN_MOVE_METERS;
          const elapsed = now - last.t;

          if (elapsed < THROTTLE_MS && !moved) return;

          let headingDeg = last.heading;
          if (
            typeof heading === "number" &&
            heading >= 0 &&
            (speed == null || speed >= MIN_SPEED_MPS_FOR_HEADING)
          ) {
            headingDeg = heading;
          }

          lastCameraRef.current = {
            t: now,
            lat: latitude,
            lng: longitude,
            heading: headingDeg,
          };

          applyCamera(latitude, longitude, headingDeg);
        }
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [navigationStyle, showsUserLocation, userLocationOk, mapReady]);

  // Reset camera smoothing when route identity changes.
  useEffect(() => {
    lastCameraRef.current = { t: 0, lat: 0, lng: 0, heading: 0 };
  }, [selectedRoute.id, selectedRoute.geometry.data]);

  if (!initialRegion) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>Route preview is not available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap} accessibilityLabel="Navigation map along your chosen path">
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
        onMapReady={onMapReady}
        mapPadding={mapPadding}
        showsUserLocation={showsUserLocation && userLocationOk}
        showsMyLocationButton={false}
        showsCompass
        showsScale={Platform.OS === "ios"}
        showsTraffic
        showsBuildings
        rotateEnabled={!navigationStyle}
        pitchEnabled={false}
        scrollEnabled
        zoomEnabled
        mapType="standard"
      >
        <Marker
          coordinate={origin}
          title="Start"
          description="Approximate start of this preview."
        />
        <Marker
          coordinate={destination}
          title="Destination"
          description="Where you are headed."
        />
        {routeCoords.length > 0 ? (
          <Polyline
            coordinates={routeCoords}
            strokeColor={ROUTE_COLOR}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minHeight: 160,
    backgroundColor: "#e5e7eb",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  fallback: {
    flex: 1,
    minHeight: 160,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f4f6",
    padding: 16,
  },
  fallbackText: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
  },
});
