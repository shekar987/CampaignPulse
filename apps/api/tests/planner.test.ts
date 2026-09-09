import { SIMULATION_PRESETS, isRetryableError } from "@campaignpulse/shared";
import { describe, expect, it } from "vitest";

import { planSimulation } from "../src/simulation/planner";

const options = {
  runId: "abc12345",
  seed: 42,
  campaignSlug: "0192b1c2",
  channels: ["WEB", "SMARTSHOP"] as const,
};

describe("planSimulation", () => {
  it("creates the preset number of deliveries per channel with exactly the planned failures", () => {
    const plan = planSimulation({ scenario: "CRITICAL" }, options);
    expect(plan.deliveries).toHaveLength(200);
    for (const channel of options.channels) {
      const forChannel = plan.deliveries.filter((delivery) => delivery.channel === channel);
      expect(forChannel).toHaveLength(SIMULATION_PRESETS.CRITICAL.deliveries);
      const failing = forChannel.filter((delivery) => delivery.simulation.script?.length);
      expect(failing).toHaveLength(SIMULATION_PRESETS.CRITICAL.failingDeliveries);
    }
  });

  it("scripts planned failures as a single retryable first-attempt error", () => {
    const plan = planSimulation({ scenario: "DEGRADED" }, options);
    for (const delivery of plan.deliveries) {
      const script = delivery.simulation.script;
      if (script) {
        expect(script).toHaveLength(1);
        expect(script[0]).not.toBe("SUCCESS");
        expect(isRetryableError(script[0] as never)).toBe(true);
      }
      expect(delivery.simulation.failureRate).toBe(0);
    }
  });

  it("applies the retry scenarios' scripts to every delivery", () => {
    const plan = planSimulation({ scenario: "DEAD_LETTER" }, options);
    expect(plan.deliveries).toHaveLength(2);
    for (const delivery of plan.deliveries) {
      expect(delivery.simulation.script).toEqual(SIMULATION_PRESETS.DEAD_LETTER.script);
    }
  });

  it("is reproducible for the same seed and differs for another", () => {
    const first = planSimulation({ scenario: "CRITICAL" }, options);
    const again = planSimulation({ scenario: "CRITICAL" }, options);
    const other = planSimulation({ scenario: "CRITICAL" }, { ...options, seed: 7 });
    expect(again).toEqual(first);
    expect(other.deliveries.map((d) => d.simulation.script)).not.toEqual(
      first.deliveries.map((d) => d.simulation.script),
    );
  });

  it("uses unique, channel-scoped correlation ids", () => {
    const plan = planSimulation({ scenario: "HEALTHY" }, options);
    const ids = plan.deliveries.map((delivery) => delivery.correlationId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toMatch(/^cmp-0192b1c2-web-abc12345-0001$/);
  });

  it("clamps custom runs to the supported range", () => {
    const plan = planSimulation(
      { scenario: "CUSTOM", deliveries: 5000, failureRate: 2 },
      { ...options, channels: ["WEB"] },
    );
    expect(plan.deliveries).toHaveLength(500);
    expect(plan.deliveries.every((delivery) => delivery.simulation.script?.length === 1)).toBe(
      true,
    );
  });

  it("rounds custom failure rates to whole deliveries", () => {
    const plan = planSimulation(
      { scenario: "CUSTOM", deliveries: 10, failureRate: 0.25 },
      { ...options, channels: ["WEB"] },
    );
    expect(plan.deliveries.filter((delivery) => delivery.simulation.script).length).toBe(3);
  });
});
