import type { HealthStatus } from "@campaignpulse/event-contracts";

/**
 * Error-rate thresholds (as fractions) used to classify delivery health.
 *
 * These are demonstration assumptions chosen to make the simulated scenarios easy to reason
 * about. They are not derived from any real operator's service level objectives.
 */
export const HEALTH_THRESHOLDS = {
  /** Error rate at or above this value is DEGRADED. */
  degraded: 0.02,
  /** Error rate at or above this value is CRITICAL. */
  critical: 0.1,
} as const;

/**
 * Classifies health from outcome counts.
 *
 * Zero events yields UNKNOWN rather than a misleading "0% success" figure, and avoids a
 * division by zero.
 */
export function calculateHealth(totalEvents: number, failedEvents: number): HealthStatus {
  if (!Number.isInteger(totalEvents) || !Number.isInteger(failedEvents)) {
    throw new RangeError("Event counts must be integers");
  }
  if (totalEvents < 0 || failedEvents < 0 || failedEvents > totalEvents) {
    throw new RangeError("Failed events must be between 0 and total events");
  }
  if (totalEvents === 0) {
    return "UNKNOWN";
  }

  const errorRate = failedEvents / totalEvents;
  if (errorRate >= HEALTH_THRESHOLDS.critical) {
    return "CRITICAL";
  }
  if (errorRate >= HEALTH_THRESHOLDS.degraded) {
    return "DEGRADED";
  }
  return "HEALTHY";
}

const SEVERITY: Record<HealthStatus, number> = {
  UNKNOWN: 0,
  HEALTHY: 1,
  DEGRADED: 2,
  CRITICAL: 3,
};

/** Orders health statuses from least to most severe. */
export function compareHealthSeverity(a: HealthStatus, b: HealthStatus): number {
  return SEVERITY[a] - SEVERITY[b];
}

/**
 * Rolls several health statuses up into one: the most severe wins. UNKNOWN only wins when
 * every input is UNKNOWN (or the list is empty), so one silent channel does not hide a
 * critical one, and one active channel is enough to report real health.
 */
export function worstHealth(statuses: readonly HealthStatus[]): HealthStatus {
  let worst: HealthStatus = "UNKNOWN";
  for (const status of statuses) {
    if (SEVERITY[status] > SEVERITY[worst]) {
      worst = status;
    }
  }
  return worst;
}
