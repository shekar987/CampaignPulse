import { pino, type Logger, type LoggerOptions } from "pino";

export type { Logger };

export interface LoggerConfig {
  level: string;
  /** Human-readable output for local development; JSON lines otherwise. */
  pretty: boolean;
}

/**
 * Creates the root logger. Every line is a single JSON object so log aggregators such as
 * CloudWatch can index fields like `correlationId`, `campaignId`, `channel` and `errorCode`
 * without parsing free text. Callers attach those fields with `logger.child({...})`.
 */
export function createLogger(config: LoggerConfig): Logger {
  const options: LoggerOptions = {
    level: config.level,
    base: { service: "campaignpulse-api" },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: "message",
  };

  if (config.pretty) {
    return pino({
      ...options,
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss.l",
          ignore: "pid,hostname,service",
          messageKey: "message",
        },
      },
    });
  }

  return pino({
    ...options,
    formatters: {
      level: (label) => ({ level: label.toUpperCase() }),
    },
  });
}
