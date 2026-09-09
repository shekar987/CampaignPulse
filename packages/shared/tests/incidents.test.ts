import { describe, expect, it } from "vitest";

import { MIN_OUTCOMES_FOR_INCIDENT, evaluateIncidentSeverity, incidentSeverityFor } from "../src";

describe("incident severity rules", () => {
  it("maps health to severity", () => {
    expect(incidentSeverityFor("CRITICAL")).toBe("CRITICAL");
    expect(incidentSeverityFor("DEGRADED")).toBe("WARNING");
    expect(incidentSeverityFor("HEALTHY")).toBeNull();
    expect(incidentSeverityFor("UNKNOWN")).toBeNull();
  });

  it("does not alert until the channel has enough attempts on record", () => {
    expect(evaluateIncidentSeverity("CRITICAL", MIN_OUTCOMES_FOR_INCIDENT - 1)).toBeNull();
    expect(evaluateIncidentSeverity("CRITICAL", MIN_OUTCOMES_FOR_INCIDENT)).toBe("CRITICAL");
    expect(evaluateIncidentSeverity("DEGRADED", 500)).toBe("WARNING");
  });

  it("never alerts on a healthy channel regardless of volume", () => {
    expect(evaluateIncidentSeverity("HEALTHY", 10_000)).toBeNull();
  });

  it("supports a custom minimum", () => {
    expect(evaluateIncidentSeverity("DEGRADED", 5, 5)).toBe("WARNING");
    expect(evaluateIncidentSeverity("DEGRADED", 4, 5)).toBeNull();
  });
});
