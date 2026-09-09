import type { Channel, SimulationParams, SimulationScenario } from "@campaignpulse/event-contracts";
import { CUSTOM_SIMULATION_LIMITS, SIMULATION_PRESETS } from "@campaignpulse/shared";

import { stableUnitInterval } from "./channel-simulator";

export interface SimulationRequest {
  scenario: SimulationScenario;
  /** CUSTOM only: deliveries per channel. */
  deliveries?: number;
  /** CUSTOM only: probability that a delivery fails its first attempt. */
  failureRate?: number;
}

export interface PlannedDelivery {
  correlationId: string;
  channel: Channel;
  simulation: SimulationParams;
}

export interface SimulationPlan {
  runId: string;
  seed: number;
  scenario: SimulationScenario;
  deliveriesPerChannel: number;
  deliveries: PlannedDelivery[];
}

const CHANNEL_SLUGS: Record<Channel, string> = {
  WEB: "web",
  MOBILE_APP: "app",
  IN_STORE_DISPLAY: "store",
  SMARTSHOP: "smartshop",
};

/**
 * Expands a scenario into concrete deliveries with per-delivery simulation parameters. Failing
 * deliveries are scripted to fail their first attempt with a retryable error, so the retry policy
 * is exercised and the outcome counts are exactly the ones the scenario promises. Which
 * deliveries fail is decided by the seed, so a run can be reproduced.
 */
export function planSimulation(
  request: SimulationRequest,
  options: { runId: string; seed: number; campaignSlug: string; channels: readonly Channel[] },
): SimulationPlan {
  const { runId, seed, campaignSlug, channels } = options;
  const deliveries: PlannedDelivery[] = [];

  let perChannel: number;
  let failing: number;
  let script: SimulationParams["script"];
  let failureRate: number;

  if (request.scenario === "CUSTOM") {
    perChannel = clamp(
      Math.round(request.deliveries ?? 50),
      CUSTOM_SIMULATION_LIMITS.minDeliveries,
      CUSTOM_SIMULATION_LIMITS.maxDeliveries,
    );
    failureRate = clamp(request.failureRate ?? 0.05, 0, 1);
    failing = Math.round(perChannel * failureRate);
    script = undefined;
  } else {
    const preset = SIMULATION_PRESETS[request.scenario];
    perChannel = preset.deliveries;
    failing = preset.failingDeliveries;
    failureRate = perChannel > 0 ? failing / perChannel : 0;
    script = preset.script;
  }

  channels.forEach((channel, channelIndex) => {
    const failingIndexes = chooseFailing(perChannel, failing, `${seed}:${channel}`);
    for (let index = 0; index < perChannel; index += 1) {
      const sequence = channelIndex * perChannel + index + 1;
      const correlationId = `cmp-${campaignSlug}-${CHANNEL_SLUGS[channel]}-${runId}-${String(sequence).padStart(4, "0")}`;
      const simulation: SimulationParams = {
        runId,
        scenario: request.scenario,
        // Unscripted attempts (retries) succeed unless the scenario says otherwise: the planned
        // failures model transient faults that clear on retry.
        failureRate: 0,
        ...(script
          ? { script }
          : failingIndexes.has(index)
            ? { script: [firstAttemptError(channel, correlationId)] }
            : {}),
      };
      deliveries.push({ correlationId, channel, simulation });
    }
  });

  return { runId, seed, scenario: request.scenario, deliveriesPerChannel: perChannel, deliveries };
}

/** Picks `count` distinct indexes below `size`, deterministically from the seed. */
function chooseFailing(size: number, count: number, seed: string): Set<number> {
  const indexes = Array.from({ length: size }, (_, i) => i);
  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(stableUnitInterval(`${seed}:${i}`) * (i + 1));
    const a = indexes[i];
    const b = indexes[j];
    if (a !== undefined && b !== undefined) {
      indexes[i] = b;
      indexes[j] = a;
    }
  }
  return new Set(indexes.slice(0, Math.min(count, size)));
}

const RETRYABLE_FIRST_ATTEMPT_ERRORS: Record<
  Channel,
  readonly ("TIMEOUT" | "NETWORK_ERROR" | "DEPENDENCY_UNAVAILABLE" | "RATE_LIMITED")[]
> = {
  WEB: ["RATE_LIMITED", "TIMEOUT"],
  MOBILE_APP: ["NETWORK_ERROR", "TIMEOUT"],
  IN_STORE_DISPLAY: ["DEPENDENCY_UNAVAILABLE", "TIMEOUT"],
  SMARTSHOP: ["TIMEOUT", "DEPENDENCY_UNAVAILABLE", "NETWORK_ERROR"],
};

function firstAttemptError(channel: Channel, correlationId: string) {
  const options = RETRYABLE_FIRST_ATTEMPT_ERRORS[channel];
  const index = Math.floor(stableUnitInterval(`${correlationId}:error`) * options.length);
  return options[index] ?? "TIMEOUT";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
