import type {
  FamilySummary,
  FamilySummaryEventRollup,
  TripEvent,
} from "@roadcopilot/contracts";
import type { TripSessionState } from "./tripSessionTypes";

const ROLLUP_PHRASES: Record<string, string> = {
  hard_brake: "Firmer slowdown moments",
  rapid_acceleration: "Quicker acceleration moments",
  sharp_swerve: "Sharper direction changes",
  lane_drift_advisory: "Lane drift alerts",
  route_deviation_optional: "Route awareness notes",
};

const EVENT_LABEL: Record<string, string> = {
  hard_brake: "Slowdown moment",
  rapid_acceleration: "Acceleration moment",
  sharp_swerve: "Direction change",
  lane_drift_advisory: "Lane drift advisory",
  route_deviation_optional: "Route note",
};

export interface FamilySummaryTimelineItem {
  occurredAt: string;
  label: string;
}

export interface FamilySummaryExtras {
  /** Simple 0–100 score; higher means fewer notable sensor moments (local UI only). */
  supportScore: number;
  topContributorMessage: string;
  narrativeLine: string;
  tripDurationLabel: string;
  timeline: FamilySummaryTimelineItem[];
  /** From trip planning; shown when present. */
  destinationLabel: string | null;
}

function formatDurationMs(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const remM = m % 60;
  const remS = s % 60;
  if (h > 0) return `${h} hr ${remM} min`;
  if (m > 0) return `${m} min ${remS} sec`;
  return `${remS} sec`;
}

function computeSupportScore(session: TripSessionState): number {
  let score = 100;
  score -= session.hardBrakeCount * 9;
  score -= session.rapidAccelerationCount * 7;
  score -= session.sharpSwerveCount * 8;
  score -= session.laneDriftCount * 6;
  return Math.max(42, Math.min(100, Math.round(score)));
}

function topContributor(session: TripSessionState): {
  message: string;
  key: string;
} {
  const entries: { key: string; count: number; label: string }[] = [
    { key: "hard_brake", count: session.hardBrakeCount, label: "firmer slowdowns" },
    {
      key: "rapid_acceleration",
      count: session.rapidAccelerationCount,
      label: "quicker accelerations",
    },
    { key: "sharp_swerve", count: session.sharpSwerveCount, label: "sharper turns or lane changes" },
    { key: "lane_drift_advisory", count: session.laneDriftCount, label: "lane drift alerts" },
  ];
  const max = entries.reduce((a, b) => (b.count > a.count ? b : a), entries[0]);
  if (max.count === 0) {
    return {
      key: "none",
      message: "No single moment type stood out — an easygoing trip overall.",
    };
  }
  const tie = entries.filter((e) => e.count === max.count);
  if (tie.length > 1) {
    return {
      key: "tie",
      message: "A few kinds of moments showed up evenly — mostly around normal driving variation.",
    };
  }
  if (max.key === "lane_drift_advisory") {
    return {
      key: max.key,
      message: "Lane drift alerts were the main contributor to this score.",
    };
  }
  if (max.key === "hard_brake") {
    return {
      key: max.key,
      message: "Firmer slowdowns were the main contributor to this score.",
    };
  }
  if (max.key === "rapid_acceleration") {
    return {
      key: max.key,
      message: "Quicker accelerations were the main contributor to this score.",
    };
  }
  return {
    key: max.key,
    message: "Sharper direction changes were the main contributor to this score.",
  };
}

function joinNatural(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function buildNarrative(session: TripSessionState): string {
  const parts: string[] = [];
  if (session.laneDriftCount > 0) {
    parts.push(
      `${session.laneDriftCount} lane drift alert${session.laneDriftCount === 1 ? "" : "s"}`
    );
  }
  if (session.hardBrakeCount > 0) {
    parts.push(
      `${session.hardBrakeCount} hard braking moment${session.hardBrakeCount === 1 ? "" : "s"}`
    );
  }
  if (session.rapidAccelerationCount > 0) {
    parts.push(
      `${session.rapidAccelerationCount} rapid acceleration moment${session.rapidAccelerationCount === 1 ? "" : "s"}`
    );
  }
  if (session.sharpSwerveCount > 0) {
    parts.push(
      `${session.sharpSwerveCount} sharp swerve${session.sharpSwerveCount === 1 ? "" : "s"}`
    );
  }
  if (parts.length === 0) {
    return "This trip looked calm on the sensors — a steady, supportive drive.";
  }
  return `This trip had ${joinNatural(parts)}.`;
}

function buildRollups(session: TripSessionState): FamilySummaryEventRollup[] {
  const roll: FamilySummaryEventRollup[] = [];
  const push = (
    type: FamilySummaryEventRollup["type"],
    count: number,
    phrase: string
  ) => {
    if (count > 0) roll.push({ type, count, supportivePhrase: phrase });
  };
  push("hard_brake", session.hardBrakeCount, ROLLUP_PHRASES.hard_brake);
  push(
    "rapid_acceleration",
    session.rapidAccelerationCount,
    ROLLUP_PHRASES.rapid_acceleration
  );
  push("sharp_swerve", session.sharpSwerveCount, ROLLUP_PHRASES.sharp_swerve);
  push(
    "lane_drift_advisory",
    session.laneDriftCount,
    ROLLUP_PHRASES.lane_drift_advisory
  );
  return roll;
}

function buildHighlights(session: TripSessionState, narrative: string): string[] {
  const h: string[] = [];
  h.push(narrative);
  const motionTotal =
    session.hardBrakeCount +
    session.rapidAccelerationCount +
    session.sharpSwerveCount;
  if (motionTotal > 0) {
    h.push(
      "Most support moments on the phone sensors show up around speed or direction changes — often near intersections or merges."
    );
  }
  if (session.laneDriftCount > 0) {
    h.push(
      "Lane alerts are advisory only — they help the family notice patterns, not to assign blame."
    );
  }
  h.push("Thank you for taking a calm look together — small check-ins go a long way.");
  return h.slice(0, 5);
}

function buildHeadline(session: TripSessionState): string {
  const total =
    session.hardBrakeCount +
    session.rapidAccelerationCount +
    session.sharpSwerveCount +
    session.laneDriftCount;
  if (total === 0) {
    return "A smooth trip — nothing loud showed up on motion sensors.";
  }
  return "Trip complete — here is a gentle, factual snapshot for family.";
}

function timelineFromEvents(events: TripEvent[]): FamilySummaryTimelineItem[] {
  return [...events]
    .sort(
      (a, b) =>
        new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    )
    .slice(-12)
    .map((e) => ({
      occurredAt: e.occurredAt,
      label: e.description ?? EVENT_LABEL[e.type] ?? "Trip moment",
    }));
}

/**
 * Builds contract-shaped {@link FamilySummary} plus local UI fields (score, narrative helpers).
 * Expects a completed trip (`endedAt` set).
 */
export function buildFamilySummaryView(
  session: TripSessionState
): { summary: FamilySummary; extras: FamilySummaryExtras } | null {
  if (!session.tripId || !session.startedAt || !session.endedAt) return null;

  const start = new Date(session.startedAt).getTime();
  const end = new Date(session.endedAt).getTime();
  const durationLabel = formatDurationMs(end - start);

  const narrativeLine = buildNarrative(session);
  const top = topContributor(session);
  const supportScore = computeSupportScore(session);
  const summary: FamilySummary = {
    tripId: session.tripId,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    headline: buildHeadline(session),
    highlights: buildHighlights(session, narrativeLine),
    eventRollups: buildRollups(session),
    routeOptionId: session.routeOptionId,
    derivedFromReplay: false,
  };

  const extras: FamilySummaryExtras = {
    supportScore,
    topContributorMessage: top.message,
    narrativeLine,
    tripDurationLabel: durationLabel,
    timeline: timelineFromEvents(session.events),
    destinationLabel: session.destinationLabel,
  };

  return { summary, extras };
}
