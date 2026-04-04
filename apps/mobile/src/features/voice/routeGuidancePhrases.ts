import type { ParsedRouteStep } from "../../services/googleRoutesClient";

/** Spoken once at trip start; calm, maps-style ETA without sounding like a command. */
export function buildTripBriefingPhrase(
  destinationLabel: string | undefined,
  durationSecondsEstimate: number | undefined
): string | null {
  const dest = destinationLabel?.trim();
  const eta = formatEtaForSpeech(durationSecondsEstimate);
  if (dest && eta) {
    return `Your trip to ${dest} should take about ${eta}. We'll share gentle hints along the way when helpful.`;
  }
  if (eta) {
    return `Your trip should take about ${eta}. We'll share gentle hints along the way when helpful.`;
  }
  if (dest) {
    return `You're set for ${dest}. We'll share gentle hints along the way when helpful.`;
  }
  return null;
}

function formatEtaForSpeech(seconds: number | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 45) {
    return null;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 90) {
    return minutes === 1 ? "a minute" : `${minutes} minutes`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) {
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  return `${h} hour${h === 1 ? "" : "s"} and ${m} minutes`;
}

/** Strip simple HTML tags and collapse whitespace for TTS. */
export function normalizeInstructionForSpeech(raw: string): string {
  let s = raw.replace(/<[^>]+>/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > 220) s = `${s.slice(0, 217)}…`;
  return s;
}

function maneuverToAdvisory(maneuver: string | undefined): string | null {
  if (!maneuver) return null;
  const m = maneuver.toUpperCase();
  if (m.includes("STRAIGHT") || m === "DEPART" || m === "CONTINUE") {
    return "Carry on along this road when it feels right.";
  }
  if (m.includes("LEFT") && m.includes("U_TURN")) {
    return "When you can, there is a gentle turnaround coming up.";
  }
  if (m.includes("RIGHT") && m.includes("U_TURN")) {
    return "When you can, there is a gentle turnaround coming up.";
  }
  if (m.includes("LEFT")) {
    return "When it fits traffic, ease a little left for the next part of the route.";
  }
  if (m.includes("RIGHT")) {
    return "When it fits traffic, ease a little right for the next part of the route.";
  }
  if (m.includes("MERGE") || m.includes("RAMP") || m.includes("FORK")) {
    return "Ahead, the road blends with another lane — merge calmly when you have space.";
  }
  if (m.includes("ROUNDABOUT")) {
    return "A roundabout is ahead; take it at a comfortable pace when you are ready.";
  }
  return "A small path change is ahead — use the map when you can.";
}

/**
 * Single line suitable for advisory TTS. Prefers API instructions (softened), else maneuver templates.
 */
export function announceTextForParsedStep(step: ParsedRouteStep): string | null {
  if (step.instructions?.trim()) {
    const n = normalizeInstructionForSpeech(step.instructions);
    if (!n) return null;
    const lower = n.toLowerCase();
    if (
      lower.startsWith("turn left") ||
      lower.startsWith("turn right") ||
      lower.startsWith("sharp left") ||
      lower.startsWith("sharp right")
    ) {
      return `When it fits, ${n.charAt(0).toLowerCase()}${n.slice(1)}`;
    }
    return n;
  }
  return maneuverToAdvisory(step.maneuver);
}
