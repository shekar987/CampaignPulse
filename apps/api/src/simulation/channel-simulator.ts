import type { Channel, ErrorCode, SimulationParams } from "@campaignpulse/event-contracts";

export type AttemptOutcome =
  | { kind: "success"; latencyMs: number }
  | { kind: "failure"; errorCode: ErrorCode; errorMessage: string; latencyMs: number };

/** Failure mix per simulated channel, as weights. */
const ERROR_WEIGHTS: Record<Channel, [ErrorCode, number][]> = {
  WEB: [
    ["RATE_LIMITED", 4],
    ["TIMEOUT", 3],
    ["VALIDATION_ERROR", 2],
    ["UNKNOWN_ERROR", 1],
  ],
  MOBILE_APP: [
    ["NETWORK_ERROR", 5],
    ["TIMEOUT", 3],
    ["DEPENDENCY_UNAVAILABLE", 1],
    ["AUTHORIZATION_ERROR", 1],
  ],
  IN_STORE_DISPLAY: [
    ["DEPENDENCY_UNAVAILABLE", 5],
    ["TIMEOUT", 3],
    ["UNKNOWN_ERROR", 2],
  ],
  SMARTSHOP: [
    ["TIMEOUT", 5],
    ["DEPENDENCY_UNAVAILABLE", 3],
    ["NETWORK_ERROR", 2],
  ],
};

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  TIMEOUT: "Channel endpoint did not respond within 3000ms",
  RATE_LIMITED: "Channel endpoint returned 429 Too Many Requests",
  VALIDATION_ERROR: "Creative payload rejected: missing required field 'creativeId'",
  DEPENDENCY_UNAVAILABLE: "Placement service returned 503 Service Unavailable",
  AUTHORIZATION_ERROR: "Delivery token was rejected by the channel (401)",
  NETWORK_ERROR: "Connection reset while streaming creative payload",
  UNKNOWN_ERROR: "Channel returned an unexpected response body",
};

const TIMEOUT_LATENCY_MS = 3000;

/** FNV-1a hash folded into [0, 1). Stable across processes, so replays are reproducible. */
export function stableUnitInterval(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 4294967296;
}

function pickWeighted(channel: Channel, roll: number): ErrorCode {
  const weights = ERROR_WEIGHTS[channel];
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let remaining = roll * total;
  for (const [code, weight] of weights) {
    remaining -= weight;
    if (remaining < 0) {
      return code;
    }
  }
  return "UNKNOWN_ERROR";
}

function failure(code: ErrorCode, roll: number): AttemptOutcome {
  return {
    kind: "failure",
    errorCode: code,
    errorMessage: ERROR_MESSAGES[code],
    latencyMs: code === "TIMEOUT" ? TIMEOUT_LATENCY_MS : 200 + Math.round(roll * 700),
  };
}

/**
 * Stands in for a real channel integration. The outcome of an attempt is a pure function of the
 * simulation parameters, the correlation id and the attempt number, so a run can be replayed
 * exactly and tests can assert on it.
 */
export function simulateAttempt(
  params: SimulationParams,
  channel: Channel,
  correlationId: string,
  attempt: number,
): AttemptOutcome {
  const roll = stableUnitInterval(`${correlationId}#${attempt}`);
  const latencyRoll = stableUnitInterval(`${correlationId}#${attempt}#latency`);

  const scripted = params.script?.[attempt - 1];
  if (scripted !== undefined) {
    return scripted === "SUCCESS"
      ? { kind: "success", latencyMs: 120 + Math.round(latencyRoll * 330) }
      : failure(scripted, latencyRoll);
  }

  if (roll < params.failureRate) {
    return failure(pickWeighted(channel, latencyRoll), latencyRoll);
  }
  return { kind: "success", latencyMs: 120 + Math.round(latencyRoll * 330) };
}
