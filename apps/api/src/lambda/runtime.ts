import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SNSClient } from "@aws-sdk/client-sns";
import { SQSClient } from "@aws-sdk/client-sqs";

import packageJson from "../../package.json" with { type: "json" };
import { createApp, type App } from "../app";
import { createDatabaseUrlResolver } from "../aws/secrets";
import { SnsNotificationPublisher } from "../aws/sns-notification-publisher";
import { SqsEventBus } from "../aws/sqs-event-bus";
import { loadConfig, type AppConfig } from "../config";
import { createPrismaClient, type PrismaClient } from "../db/client";
import type { EventBus } from "../events/event-bus";
import { createLogger, type Logger } from "../logging/logger";
import {
  LogNotificationPublisher,
  type NotificationPublisher,
} from "../notifications/notification-publisher";
import { DeliveryProcessor } from "../processing/delivery-processor";
import { SystemService, buildServices, type Services } from "../services";

export interface LambdaRuntime {
  config: AppConfig;
  logger: Logger;
  db: PrismaClient;
  bus: EventBus;
  notifications: NotificationPublisher;
  services: Services;
  processor: DeliveryProcessor;
  app: App;
}

const resolveDatabaseUrl = createDatabaseUrlResolver(() => new SecretsManagerClient({}));
let runtime: Promise<LambdaRuntime> | null = null;

/**
 * Builds the application once per Lambda execution environment. Every handler shares the same
 * database client, SQS/SNS clients and service graph across warm invocations.
 */
export function getRuntime(): Promise<LambdaRuntime> {
  runtime ??= build().catch((error: unknown) => {
    runtime = null;
    throw error;
  });
  return runtime;
}

async function build(): Promise<LambdaRuntime> {
  const databaseUrl = await resolveDatabaseUrl();
  const config = loadConfig({ ...process.env, DATABASE_URL: databaseUrl });
  const logger = createLogger({ level: config.LOG_LEVEL, pretty: false });
  const db = createPrismaClient(config.DATABASE_URL);

  const bus: EventBus =
    config.EVENT_BUS === "sqs" && config.DELIVERY_QUEUE_URL
      ? new SqsEventBus({ queueUrl: config.DELIVERY_QUEUE_URL, client: new SQSClient({}), logger })
      : failClosedBus();
  const notifications: NotificationPublisher =
    config.NOTIFICATIONS === "sns" && config.INCIDENT_TOPIC_ARN
      ? new SnsNotificationPublisher({
          topicArn: config.INCIDENT_TOPIC_ARN,
          client: new SNSClient({}),
          logger,
        })
      : new LogNotificationPublisher(logger);

  const system = new SystemService({ version: packageJson.version, environment: config.NODE_ENV });
  const services = buildServices({ db, logger, system, bus, notifications });
  const processor = new DeliveryProcessor({
    db,
    bus,
    health: services.health,
    incidents: services.incidents,
    notifications,
    logger,
    options: { latencyScale: config.SIMULATION_LATENCY_SCALE },
  });
  const app = createApp({ db, logger, config, version: packageJson.version, bus, notifications });

  logger.info(
    { eventBus: config.EVENT_BUS, notifications: config.NOTIFICATIONS },
    "lambda runtime initialised",
  );
  return { config, logger, db, bus, notifications, services, processor, app };
}

/** In AWS the in-process bus makes no sense: refuse loudly rather than silently drop events. */
function failClosedBus(): EventBus {
  const reject = () =>
    Promise.reject(new Error("EVENT_BUS must be sqs with DELIVERY_QUEUE_URL set in AWS"));
  return { publish: reject, publishBatch: reject };
}
