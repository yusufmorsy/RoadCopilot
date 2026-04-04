import type { TripEventType } from "./trip-event.js";

/**
 * Post-trip summary for family caregivers — supportive, factual, non-punitive.
 * Required MVP surface: must be generatable from trip + events.
 */
export interface FamilySummaryEventRollup {
  type: TripEventType;
  count: number;
  /** Short calm phrase, e.g. "A few gentle slowdowns". */
  supportivePhrase: string;
}

export interface FamilySummary {
  tripId: string;
  /** ISO 8601 start/end in UTC. */
  startedAt: string;
  endedAt: string;
  /** Opening line in a warm, elder-respecting tone. */
  headline: string;
  /** 2–5 bullet-style lines; no blame language. */
  highlights: string[];
  eventRollups: FamilySummaryEventRollup[];
  /** Optional reference to chosen route option id. */
  routeOptionId?: string;
  /** Replay/demo mode: true if summary derived from uploaded replay, not live drive. */
  derivedFromReplay?: boolean;
}
