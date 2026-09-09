import type { HealthStatus } from "@campaignpulse/event-contracts";

/**
 * Minimum number of recorded delivery attempts a channel needs before its error rate is
 * trusted enough to open an incident. One failure among the first handful of deliveries reads
 * as a 20% error rate, which is noise, not an outage. The health badge still reflects the raw
 * rate; only alerting waits for volume. A demo assumption, like the thresholds themselves.
 */
export const MIN_OUTCOMES_FOR_INCIDENT = 100;

export type IncidentSeverity = "WARNING" | "CRITICAL";

/** Maps channel health to the severity of the incident it warrants, if any. */
export function incidentSeverityFor(health: HealthStatus): IncidentSeverity | null {
  if (health === "CRITICAL") {
    return "CRITICAL";
  }
  if (health === "DEGRADED") {
    return "WARNING";
  }
  return null;
}

/**
 * Whether an incident should be open for a channel with the given health and attempt volume.
 * Returns the severity to open (or escalate to), or null when no incident is warranted.
 */
export function evaluateIncidentSeverity(
  health: HealthStatus,
  totalOutcomes: number,
  minimumOutcomes: number = MIN_OUTCOMES_FOR_INCIDENT,
): IncidentSeverity | null {
  if (totalOutcomes < minimumOutcomes) {
    return null;
  }
  return incidentSeverityFor(health);
}
