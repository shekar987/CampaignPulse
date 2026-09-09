import type { SimulationParams } from "@campaignpulse/event-contracts";
import { describe, expect, it } from "vitest";

import { simulateAttempt, stableUnitInterval } from "../src/simulation/channel-simulator";

const base: SimulationParams = { runId: "run", scenario: "CUSTOM", failureRate: 0 };

describe("stableUnitInterval", () => {
  it("is deterministic and within [0, 1)", () => {
    for (const input of ["a", "cmp-1-web-0001#1", "", "🚀"]) {
      const value = stableUnitInterval(input);
      expect(value).toBe(stableUnitInterval(input));
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("spreads values roughly uniformly", () => {
    const samples = Array.from({ length: 2000 }, (_, i) => stableUnitInterval(`sample-${i}`));
    const below = samples.filter((value) => value < 0.5).length;
    expect(below).toBeGreaterThan(850);
    expect(below).toBeLessThan(1150);
  });
});

describe("simulateAttempt", () => {
  it("follows the script for the scripted attempts", () => {
    const params: SimulationParams = { ...base, script: ["TIMEOUT", "SUCCESS"] };
    const first = simulateAttempt(params, "SMARTSHOP", "cmp-x", 1);
    const second = simulateAttempt(params, "SMARTSHOP", "cmp-x", 2);
    expect(first).toMatchObject({ kind: "failure", errorCode: "TIMEOUT", latencyMs: 3000 });
    expect(second.kind).toBe("success");
  });

  it("falls back to the failure rate beyond the script", () => {
    const never = simulateAttempt({ ...base, script: ["TIMEOUT"] }, "WEB", "cmp-x", 2);
    expect(never.kind).toBe("success");
    const always = simulateAttempt({ ...base, failureRate: 1 }, "WEB", "cmp-x", 1);
    expect(always.kind).toBe("failure");
  });

  it("is a pure function of its inputs", () => {
    const params: SimulationParams = { ...base, failureRate: 0.5 };
    const a = simulateAttempt(params, "MOBILE_APP", "cmp-repeat", 1);
    const b = simulateAttempt(params, "MOBILE_APP", "cmp-repeat", 1);
    expect(b).toEqual(a);
  });

  it("produces failure rates close to the configured probability", () => {
    const params: SimulationParams = { ...base, failureRate: 0.2 };
    let failures = 0;
    for (let i = 0; i < 2000; i += 1) {
      if (simulateAttempt(params, "WEB", `cmp-rate-${i}`, 1).kind === "failure") {
        failures += 1;
      }
    }
    expect(failures / 2000).toBeGreaterThan(0.15);
    expect(failures / 2000).toBeLessThan(0.25);
  });

  it("always attaches a message and positive latency to failures", () => {
    const params: SimulationParams = { ...base, failureRate: 1 };
    for (let i = 0; i < 50; i += 1) {
      const outcome = simulateAttempt(params, "IN_STORE_DISPLAY", `cmp-msg-${i}`, 1);
      expect(outcome.kind).toBe("failure");
      if (outcome.kind === "failure") {
        expect(outcome.errorMessage.length).toBeGreaterThan(0);
        expect(outcome.latencyMs).toBeGreaterThan(0);
      }
    }
  });
});
