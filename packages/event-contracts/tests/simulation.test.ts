import { describe, expect, it } from "vitest";

import { SimulationParamsSchema, readSimulationParams } from "../src";

const params = {
  runId: "run-1",
  scenario: "CRITICAL",
  failureRate: 0.22,
  script: ["TIMEOUT", "SUCCESS"],
};

describe("SimulationParamsSchema", () => {
  it("accepts well-formed parameters", () => {
    expect(SimulationParamsSchema.safeParse(params).success).toBe(true);
  });

  it.each([
    ["failure rate above 1", { ...params, failureRate: 1.5 }],
    ["unknown scenario", { ...params, scenario: "CHAOS" }],
    ["unknown script entry", { ...params, script: ["EXPLODED"] }],
    ["missing run id", { ...params, runId: "" }],
  ])("rejects %s", (_label, candidate) => {
    expect(SimulationParamsSchema.safeParse(candidate).success).toBe(false);
  });
});

describe("readSimulationParams", () => {
  it("extracts parameters from event metadata", () => {
    expect(readSimulationParams({ simulation: params, worker: "w1" })).toEqual(params);
  });

  it("returns null for missing or malformed metadata", () => {
    expect(readSimulationParams(undefined)).toBeNull();
    expect(readSimulationParams({})).toBeNull();
    expect(readSimulationParams({ simulation: { runId: "x" } })).toBeNull();
  });
});
