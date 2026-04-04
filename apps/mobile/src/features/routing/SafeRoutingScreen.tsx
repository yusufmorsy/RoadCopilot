import type { RouteOption } from "@roadcopilot/contracts";
import * as Location from "expo-location";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigationTrip } from "../navigation/NavigationTripContext";
import type { RouteModeId } from "../navigation/types";
import { planRouteOptionsFromDestinationText, type PlannedRoutesResult } from "./planRouteOptions";
import { RouteOptionCard } from "./RouteOptionCard";
import { getPlanFallbackOrigin } from "../../config/expoPublicEnv";
import type { LatLng } from "../../services/googleRoutesClient";
import { getGoogleMapsApiKeyFromEnv } from "../../services/googleRoutesClient";
import { createStubGoogleRoadsClient } from "../../services/googleRoadsClient";

async function resolveOriginLatLng(): Promise<LatLng> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") {
    const fallback = getPlanFallbackOrigin();
    if (fallback) return fallback;
    throw new Error(
      "Location is off. Allow location for this app, or set EXPO_PUBLIC_FALLBACK_ORIGIN_LAT and EXPO_PUBLIC_FALLBACK_ORIGIN_LNG in apps/mobile/.env (see .env.example)."
    );
  }
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

function routeModeFromOption(option: RouteOption): RouteModeId {
  return option.id === "fastest" ? "fastest" : "safer";
}

export type SafeRoutingScreenProps = {
  onContinueToDrive?: () => void;
};

export function SafeRoutingScreen({ onContinueToDrive }: SafeRoutingScreenProps = {}) {
  const { trip, setTrip, clearTrip } = useNavigationTrip();
  const [destination, setDestination] = useState("");
  const [loading, setLoading] = useState(false);
  const [planned, setPlanned] = useState<PlannedRoutesResult | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<LatLng | null>(null);

  const hasKey = Boolean(getGoogleMapsApiKeyFromEnv());

  const onPlanRoutes = useCallback(async () => {
    const trimmed = destination.trim();
    if (hasKey && !trimmed) {
      Alert.alert("Add a destination", "Enter an address or place name to load live routes.");
      return;
    }
    setLoading(true);
    setPlanned(null);
    setSelectedId(null);
    try {
      const o = await resolveOriginLatLng();
      setOrigin(o);
      const result = await planRouteOptionsFromDestinationText({
        origin: o,
        destinationQuery: trimmed,
      });
      setPlanned(result);
      setSelectedId(result.options.find((r) => r.id === "safer")?.id ?? result.options[0]?.id ?? null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      Alert.alert("Could not plan routes", message);
    } finally {
      setLoading(false);
    }
  }, [destination, hasKey]);

  const onConfirmRoute = useCallback(async () => {
    if (!planned || !selectedId || !origin) return;
    const selected = planned.options.find((o) => o.id === selectedId);
    if (!selected) return;

    const fastest = planned.options.find((o) => o.id === "fastest");
    const safer = planned.options.find((o) => o.id === "safer");

    setTrip({
      destinationLabel: planned.formattedDestination,
      destinationLatLng: planned.destinationLatLng,
      originLatLng: origin,
      selectedRouteMode: routeModeFromOption(selected),
      selectedRoute: selected,
      plannedAtIso: new Date().toISOString(),
      routeSummary: {
        fastestDurationSeconds: fastest?.durationSecondsEstimate,
        saferDurationSeconds: safer?.durationSecondsEstimate,
        usedLiveGoogle: planned.usedLiveGoogle,
      },
    });

    // Touch Roads stub so the integration point stays visible to readers/refactors.
    const roads = createStubGoogleRoadsClient();
    await roads.fetchSpeedLimitsAlongRoute([origin, planned.destinationLatLng]);
  }, [origin, planned, selectedId, setTrip]);

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Safe routing</Text>
      <Text style={styles.lede}>
        Pick a destination, compare a fastest path with a calmer one, then save your choice before you
        drive. RoadCopilot stays advisory only.
      </Text>

      {!hasKey ? (
        <Text style={styles.banner}>
          Demo mode: add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to apps/mobile/.env (copy from .env.example)
          for live Google Routes and Geocoding. Until then, sample fastest vs safer options illustrate
          the flow.
        </Text>
      ) : null}

      <Text style={styles.label}>Where are you headed?</Text>
      <TextInput
        value={destination}
        onChangeText={setDestination}
        placeholder="Address or place name"
        placeholderTextColor="#8892a0"
        style={styles.input}
        autoCorrect
        autoCapitalize="words"
        returnKeyType="done"
        onSubmitEditing={onPlanRoutes}
      />

      <TouchableOpacity
        style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
        onPress={onPlanRoutes}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="See route options"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryButtonText}>See route options</Text>
        )}
      </TouchableOpacity>

      {planned ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your choices</Text>
          <Text style={styles.sectionSub}>
            {planned.usedLiveGoogle ? "From Google Routes" : "Sample data for demo"}
            {" · "}
            {planned.formattedDestination}
          </Text>
          {planned.options.map((opt) => (
            <RouteOptionCard
              key={opt.id}
              option={opt}
              selected={selectedId === opt.id}
              onSelect={() => setSelectedId(opt.id)}
            />
          ))}

          <TouchableOpacity
            style={[styles.secondaryButton, !selectedId && styles.secondaryButtonDisabled]}
            onPress={onConfirmRoute}
            disabled={!selectedId}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>Use this route</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {trip ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ready for the next step</Text>
          <Text style={styles.summaryText}>
            Saved: {trip.selectedRoute.label} toward {trip.destinationLabel}. Open the Drive tab when you
            are ready to start a trip — lane and motion awareness stay advisory only.
          </Text>
          {onContinueToDrive ? (
            <TouchableOpacity
              style={[styles.primaryButton, styles.continueDrive]}
              onPress={onContinueToDrive}
              accessibilityRole="button"
              accessibilityLabel="Continue to drive tab"
            >
              <Text style={styles.primaryButtonText}>Continue to drive</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.mono}>
            mode={trip.selectedRouteMode} · polyline ({trip.selectedRoute.geometry.format}) length{" "}
            {trip.selectedRoute.geometry.data.length}
          </Text>
          <TouchableOpacity style={styles.ghostButton} onPress={clearTrip} accessibilityRole="button">
            <Text style={styles.ghostButtonText}>Clear saved route</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.placeholderTitle}>How it fits together</Text>
          <Text style={styles.placeholderBody}>
            After you pick a route, the Drive tab starts your trip, reads lane position when the camera
            can see the road, and logs gentle motion highlights on this phone. The Summary tab offers a
            supportive snapshot for family — never a scoreboard.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  lede: {
    fontSize: 16,
    lineHeight: 24,
    color: "#374151",
    marginBottom: 16,
  },
  banner: {
    backgroundColor: "#fffbeb",
    borderColor: "#fcd34d",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    color: "#78350f",
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fff",
    marginBottom: 14,
  },
  primaryButton: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  continueDrive: {
    marginTop: 12,
  },
  section: {
    marginTop: 28,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
  },
  secondaryButton: {
    marginTop: 4,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#111827",
  },
  secondaryButtonDisabled: {
    opacity: 0.45,
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  summaryText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#374151",
    marginBottom: 8,
  },
  mono: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "Courier",
    marginBottom: 12,
  },
  ghostButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  ghostButtonText: {
    fontSize: 15,
    color: "#2563eb",
    fontWeight: "600",
  },
  placeholderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  placeholderBody: {
    fontSize: 15,
    lineHeight: 22,
    color: "#4b5563",
  },
});
