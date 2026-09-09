import type { EventType } from "@campaignpulse/event-contracts";

/**
 * Each delivery attempt produces exactly one outcome event. Successes and failures are
 * counted per attempt, so a delivery that fails twice and then succeeds contributes two
 * failures and one success. DELIVERY_FINAL_FAILURE is a lifecycle marker recorded after the
 * last failed attempt (the delivery moves to the dead-letter queue) and is deliberately not
 * counted again as a failure.
 */
export const SUCCESS_EVENT_TYPES: readonly EventType[] = [
  "DELIVERY_SUCCEEDED",
  "DELIVERY_RETRY_SUCCEEDED",
];
export const FAILURE_EVENT_TYPES: readonly EventType[] = ["DELIVERY_FAILED"];

export type DeliveryOutcome = "success" | "failure";

/** Returns the outcome an event type represents, or null for non-outcome events. */
export function classifyOutcome(eventType: EventType): DeliveryOutcome | null {
  if (SUCCESS_EVENT_TYPES.includes(eventType)) {
    return "success";
  }
  if (FAILURE_EVENT_TYPES.includes(eventType)) {
    return "failure";
  }
  return null;
}

export interface OutcomeCounts {
  successes: number;
  failures: number;
  /** Sum of latencies (ms) across outcome events that recorded a latency. */
  latencySumMs?: number;
  /** Number of outcome events that recorded a latency. */
  latencySamples?: number;
}

export interface DeliveryMetrics {
  totalEvents: number;
  successfulEvents: number;
  failedEvents: number;
  /** Fraction in [0, 1], or null when there are no events to measure. */
  successRate: number | null;
  /** Fraction in [0, 1], or null when there are no events to measure. */
  errorRate: number | null;
  /** Mean latency in milliseconds, or null when no latency was recorded. */
  avgLatencyMs: number | null;
}

export const EMPTY_METRICS: DeliveryMetrics = {
  totalEvents: 0,
  successfulEvents: 0,
  failedEvents: 0,
  successRate: null,
  errorRate: null,
  avgLatencyMs: null,
};

/** Turns raw outcome counts into the metrics shown throughout the product. */
export function computeMetrics(counts: OutcomeCounts): DeliveryMetrics {
  const { successes, failures, latencySumMs = 0, latencySamples = 0 } = counts;
  if (successes < 0 || failures < 0 || latencySamples < 0) {
    throw new RangeError("Counts cannot be negative");
  }

  const totalEvents = successes + failures;
  if (totalEvents === 0) {
    return { ...EMPTY_METRICS };
  }

  return {
    totalEvents,
    successfulEvents: successes,
    failedEvents: failures,
    successRate: successes / totalEvents,
    errorRate: failures / totalEvents,
    avgLatencyMs: latencySamples > 0 ? latencySumMs / latencySamples : null,
  };
}

/** Sums several outcome counts, e.g. per-channel counts into a campaign total. */
export function mergeOutcomeCounts(parts: readonly OutcomeCounts[]): OutcomeCounts {
  return parts.reduce<Required<OutcomeCounts>>(
    (acc, part) => ({
      successes: acc.successes + part.successes,
      failures: acc.failures + part.failures,
      latencySumMs: acc.latencySumMs + (part.latencySumMs ?? 0),
      latencySamples: acc.latencySamples + (part.latencySamples ?? 0),
    }),
    { successes: 0, failures: 0, latencySumMs: 0, latencySamples: 0 },
  );
}
