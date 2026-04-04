import type { RouteGuidanceStep } from "../navigation/types";
import type { LatLng } from "../../services/googleRoutesClient";

function interpolate(origin: LatLng, dest: LatLng, t: number): LatLng {
  return {
    latitude: origin.latitude + (dest.latitude - origin.latitude) * t,
    longitude: origin.longitude + (dest.longitude - origin.longitude) * t,
  };
}

/** Demo guidance when Google Routes is not used — distinct copy for fastest vs calmer. */
export function buildMockGuidanceByOptionId(
  origin: LatLng,
  dest: LatLng
): { fastest: RouteGuidanceStep[]; safer: RouteGuidanceStep[] } {
  const fastest: RouteGuidanceStep[] = [
    {
      announceText:
        "Your route is on screen. Carry on along the road ahead when it feels right.",
      endLatLng: interpolate(origin, dest, 0.15),
    },
    {
      announceText:
        "When it fits traffic, ease a little for the next part of the path.",
      endLatLng: interpolate(origin, dest, 0.45),
    },
    {
      announceText:
        "You are nearing your destination — slow down comfortably when you can.",
      endLatLng: interpolate(origin, dest, 0.88),
    },
  ];
  const safer: RouteGuidanceStep[] = [
    {
      announceText: "Your calmer route is on screen. Take your time; there is no rush.",
      endLatLng: interpolate(origin, dest, 0.12),
    },
    {
      announceText: "Ahead, favor smooth merges when you have a comfortable gap.",
      endLatLng: interpolate(origin, dest, 0.5),
    },
    {
      announceText: "You are drawing near your destination.",
      endLatLng: interpolate(origin, dest, 0.9),
    },
  ];
  return { fastest, safer };
}
