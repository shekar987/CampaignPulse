import type { ErrorCode, SimulationScenario } from "@campaignpulse/event-contracts";

export type AttemptScriptEntry = "SUCCESS" | ErrorCode;

export interface SimulationPreset {
  label: string;
  description: string;
  /** Deliveries to request per selected channel. */
  deliveries: number;
  /** How many of those deliveries fail their first attempt (they recover on retry). */
  failingDeliveries: number;
  /** Fixed attempt outcomes applied to every delivery in the run, for the retry scenarios. */
  script?: AttemptScriptEntry[];
}

/**
 * Deterministic scenarios behind the "Run simulation" control. The first three reproduce the
 * health thresholds; the last three exercise the retry policy and the dead-letter queue.
 */
export const SIMULATION_PRESETS: Record<Exclude<SimulationScenario, "CUSTOM">, SimulationPreset> = {
  HEALTHY: {
    label: "Healthy",
    description: "100 deliveries, 1 transient failure (1% error rate).",
    deliveries: 100,
    failingDeliveries: 1,
  },
  DEGRADED: {
    label: "Degraded",
    description: "100 deliveries, 6 transient failures (6% error rate).",
    deliveries: 100,
    failingDeliveries: 6,
  },
  CRITICAL: {
    label: "Critical",
    description: "100 deliveries, 22 transient failures (22% error rate).",
    deliveries: 100,
    failingDeliveries: 22,
  },
  RETRY_SUCCESS: {
    label: "Retry that succeeds",
    description: "One delivery that times out twice and succeeds on the third attempt.",
    deliveries: 1,
    failingDeliveries: 1,
    script: ["TIMEOUT", "TIMEOUT", "SUCCESS"],
  },
  DEAD_LETTER: {
    label: "Retries exhausted",
    description: "One delivery that fails all three attempts and is dead-lettered.",
    deliveries: 1,
    failingDeliveries: 1,
    script: ["TIMEOUT", "DEPENDENCY_UNAVAILABLE", "NETWORK_ERROR"],
  },
  NON_RETRYABLE: {
    label: "Non-retryable failure",
    description: "One delivery rejected with a validation error; dead-lettered without retries.",
    deliveries: 1,
    failingDeliveries: 1,
    script: ["VALIDATION_ERROR"],
  },
};

export const SCENARIO_LABELS: Record<SimulationScenario, string> = {
  HEALTHY: SIMULATION_PRESETS.HEALTHY.label,
  DEGRADED: SIMULATION_PRESETS.DEGRADED.label,
  CRITICAL: SIMULATION_PRESETS.CRITICAL.label,
  RETRY_SUCCESS: SIMULATION_PRESETS.RETRY_SUCCESS.label,
  DEAD_LETTER: SIMULATION_PRESETS.DEAD_LETTER.label,
  NON_RETRYABLE: SIMULATION_PRESETS.NON_RETRYABLE.label,
  CUSTOM: "Custom",
};

export const CUSTOM_SIMULATION_LIMITS = {
  minDeliveries: 1,
  maxDeliveries: 500,
} as const;
