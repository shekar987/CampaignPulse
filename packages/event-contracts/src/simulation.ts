import { z } from "zod";

import { ErrorCodeSchema } from "./enums";

export const SIMULATION_SCENARIOS = [
  "HEALTHY",
  "DEGRADED",
  "CRITICAL",
  "RETRY_SUCCESS",
  "DEAD_LETTER",
  "NON_RETRYABLE",
  "CUSTOM",
] as const;
export const SimulationScenarioSchema = z.enum(SIMULATION_SCENARIOS);
export type SimulationScenario = z.infer<typeof SimulationScenarioSchema>;

export const AttemptScriptEntrySchema = z.union([z.literal("SUCCESS"), ErrorCodeSchema]);

/**
 * Parameters a simulated channel uses to decide the outcome of each attempt. They travel in
 * `DeliveryEvent.metadata.simulation` and are stored on the delivery so retries and replays see
 * the same settings.
 */
export const SimulationParamsSchema = z.object({
  runId: z.string().min(1).max(64),
  scenario: SimulationScenarioSchema,
  /** Probability in [0, 1] that an unscripted attempt fails. */
  failureRate: z.number().min(0).max(1),
  /** Fixed outcomes for attempts 1..n; attempts beyond the script fall back to `failureRate`. */
  script: z.array(AttemptScriptEntrySchema).max(10).optional(),
  /** Correlation id of the dead-lettered delivery this one replays, if any. */
  replayOf: z.string().min(1).max(255).optional(),
});
export type SimulationParams = z.infer<typeof SimulationParamsSchema>;

/** Reads simulation parameters out of event metadata, if present and well-formed. */
export function readSimulationParams(metadata: unknown): SimulationParams | null {
  if (typeof metadata !== "object" || metadata === null || !("simulation" in metadata)) {
    return null;
  }
  const result = SimulationParamsSchema.safeParse((metadata as { simulation: unknown }).simulation);
  return result.success ? result.data : null;
}
