import { describe, expect, it } from "vitest";

import { HEALTH_THRESHOLDS, calculateHealth, compareHealthSeverity, worstHealth } from "../src";

describe("calculateHealth", () => {
  it("returns UNKNOWN when there are no events instead of dividing by zero", () => {
    expect(calculateHealth(0, 0)).toBe("UNKNOWN");
  });

  it.each([
    [100, 0, "HEALTHY"],
    [100, 1, "HEALTHY"],
    [1000, 19, "HEALTHY"], // 1.9%, just under the degraded threshold
    [100, 2, "DEGRADED"], // exactly 2%
    [1000, 99, "DEGRADED"], // 9.9%, just under the critical threshold
    [100, 10, "CRITICAL"], // exactly 10%
    [100, 22, "CRITICAL"],
    [1, 1, "CRITICAL"],
  ] as const)("classifies %i events with %i failures as %s", (total, failed, expected) => {
    expect(calculateHealth(total, failed)).toBe(expected);
  });

  it("matches the documented demo scenarios", () => {
    expect(calculateHealth(100, 1)).toBe("HEALTHY");
    expect(calculateHealth(100, 6)).toBe("DEGRADED");
    expect(calculateHealth(100, 22)).toBe("CRITICAL");
  });

  it("exposes the thresholds used for classification", () => {
    expect(HEALTH_THRESHOLDS).toEqual({ degraded: 0.02, critical: 0.1 });
  });

  it.each([
    [-1, 0],
    [10, -1],
    [5, 6],
    [1.5, 0],
  ])("rejects impossible counts (%i total, %i failed)", (total, failed) => {
    expect(() => calculateHealth(total, failed)).toThrow(RangeError);
  });
});

describe("worstHealth", () => {
  it("returns the most severe status", () => {
    expect(worstHealth(["HEALTHY", "CRITICAL", "DEGRADED"])).toBe("CRITICAL");
    expect(worstHealth(["HEALTHY", "DEGRADED"])).toBe("DEGRADED");
  });

  it("ignores UNKNOWN when any channel has real data", () => {
    expect(worstHealth(["UNKNOWN", "HEALTHY"])).toBe("HEALTHY");
    expect(worstHealth(["HEALTHY", "UNKNOWN", "DEGRADED"])).toBe("DEGRADED");
  });

  it("returns UNKNOWN only when nothing has data", () => {
    expect(worstHealth([])).toBe("UNKNOWN");
    expect(worstHealth(["UNKNOWN", "UNKNOWN"])).toBe("UNKNOWN");
  });
});

describe("compareHealthSeverity", () => {
  it("sorts from least to most severe", () => {
    const sorted = (["CRITICAL", "UNKNOWN", "DEGRADED", "HEALTHY"] as const)
      .slice()
      .sort(compareHealthSeverity);
    expect(sorted).toEqual(["UNKNOWN", "HEALTHY", "DEGRADED", "CRITICAL"]);
  });
});
