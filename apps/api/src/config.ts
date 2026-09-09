import { z } from "zod";

const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal", "silent"] as const;

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(LOG_LEVELS).default("info"),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (value) => /^postgres(ql)?:\/\//.test(value),
      "DATABASE_URL must be a postgresql:// connection string",
    ),

  /** Message transport: in-process for local development, SQS in AWS. */
  EVENT_BUS: z.enum(["local", "sqs"]).default("local"),
  /** Where incident and dead-letter notifications go. */
  NOTIFICATIONS: z.enum(["log", "sns"]).default("log"),
  /** Concurrent handlers for the local bus, like several workers draining a queue. */
  LOCAL_BUS_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),
  /** Multiplier on the retry backoff (5 s, 30 s). 0.1 keeps local demos snappy. */
  RETRY_BACKOFF_SCALE: z.coerce.number().min(0).max(10).default(1),
  /** Multiplier on simulated channel latency while a worker waits for an attempt to complete. */
  SIMULATION_LATENCY_SCALE: z.coerce.number().min(0).max(1).default(0.05),

  /** AWS wiring; only read when EVENT_BUS or NOTIFICATIONS use AWS services. */
  AWS_REGION: z.string().min(1).optional(),
  DELIVERY_QUEUE_URL: z.string().url().optional(),
  DEAD_LETTER_QUEUE_URL: z.string().url().optional(),
  INCIDENT_TOPIC_ARN: z.string().min(1).optional(),
});

export type AppConfig = z.infer<typeof envSchema>;

/**
 * Parses and validates process environment into a typed config. Fails fast with every
 * problem listed, so a misconfigured deployment never starts half-working.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const config = result.data;
  if (config.EVENT_BUS === "sqs" && !config.DELIVERY_QUEUE_URL) {
    throw new Error(
      "Invalid environment configuration: DELIVERY_QUEUE_URL is required when EVENT_BUS=sqs",
    );
  }
  if (config.NOTIFICATIONS === "sns" && !config.INCIDENT_TOPIC_ARN) {
    throw new Error(
      "Invalid environment configuration: INCIDENT_TOPIC_ARN is required when NOTIFICATIONS=sns",
    );
  }
  return config;
}
