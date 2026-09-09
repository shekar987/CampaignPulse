import { describe, expect, it } from "vitest";

import { EMPTY_METRICS, classifyOutcome, computeMetrics, mergeOutcomeCounts } from "../src";

describe("computeMetrics", () => {
  it("returns null rates when there is nothing to measure", () => {
    expect(computeMetrics({ successes: 0, failures: 0 })).toEqual(EMPTY_METRICS);
  });

  it("computes rates as fractions", () => {
    const metrics = computeMetrics({ successes: 94, failures: 6 });
    expect(metrics.totalEvents).toBe(100);
    expect(metrics.successRate).toBeCloseTo(0.94);
    expect(metrics.errorRate).toBeCloseTo(0.06);
    expect(metrics.avgLatencyMs).toBeNull();
  });

  it("averages latency over the samples that recorded one", () => {
    const metrics = computeMetrics({
      successes: 3,
      failures: 1,
      latencySumMs: 900,
      latencySamples: 3,
    });
    expect(metrics.avgLatencyMs).toBe(300);
  });

  it("rejects negative counts", () => {
    expect(() => computeMetrics({ successes: -1, failures: 0 })).toThrow(RangeError);
  });
});

describe("classifyOutcome", () => {
  it("treats first-attempt and retry successes as successes", () => {
    expect(classifyOutcome("DELIVERY_SUCCEEDED")).toBe("success");
    expect(classifyOutcome("DELIVERY_RETRY_SUCCEEDED")).toBe("success");
  });

  it("counts each failed attempt once and not the final-failure marker", () => {
    expect(classifyOutcome("DELIVERY_FAILED")).toBe("failure");
    expect(classifyOutcome("DELIVERY_FINAL_FAILURE")).toBeNull();
  });

  it("ignores lifecycle and incident events", () => {
    expect(classifyOutcome("CAMPAIGN_DELIVERY_REQUESTED")).toBeNull();
    expect(classifyOutcome("DELIVERY_STARTED")).toBeNull();
    expect(classifyOutcome("INCIDENT_CREATED")).toBeNull();
  });
});

describe("mergeOutcomeCounts", () => {
  it("sums counts and latency samples across parts", () => {
    expect(
      mergeOutcomeCounts([
        { successes: 10, failures: 1, latencySumMs: 1000, latencySamples: 10 },
        { successes: 5, failures: 5 },
      ]),
    ).toEqual({ successes: 15, failures: 6, latencySumMs: 1000, latencySamples: 10 });
  });
});
