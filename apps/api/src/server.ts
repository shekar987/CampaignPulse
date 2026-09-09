import "dotenv/config";

import { createServer } from "node:http";

import packageJson from "../package.json" with { type: "json" };
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createPrismaClient } from "./db/client";
import { LocalEventBus } from "./events/local-event-bus";
import { createLogger } from "./logging/logger";
import { LogNotificationPublisher } from "./notifications/notification-publisher";
import { DeliveryProcessor } from "./processing/delivery-processor";
import { SystemService, buildServices } from "./services";

const config = loadConfig();
const logger = createLogger({
  level: config.LOG_LEVEL,
  pretty: config.NODE_ENV === "development",
});
const db = createPrismaClient(config.DATABASE_URL);

try {
  await db.$connect();
} catch (error) {
  logger.fatal(
    { err: error },
    "Cannot connect to PostgreSQL. Is the database running? Try `npm run db:up` from the repository root.",
  );
  process.exit(1);
}

if (config.EVENT_BUS !== "local") {
  logger.fatal(
    { eventBus: config.EVENT_BUS },
    "The local server only supports EVENT_BUS=local; the SQS transport runs in AWS Lambda.",
  );
  process.exit(1);
}

// Locally the API process also hosts the worker: an in-memory bus with SQS-like semantics
// feeds the same delivery processor that runs in Lambda against SQS.
const notifications = new LogNotificationPublisher(logger);
const workerServices = buildServices({
  db,
  logger: logger.child({ component: "worker" }),
  system: new SystemService({ version: packageJson.version, environment: config.NODE_ENV }),
  bus: { publish: async () => {}, publishBatch: async () => {} },
  notifications,
});
const bus = new LocalEventBus({
  logger,
  concurrency: config.LOCAL_BUS_CONCURRENCY,
  delayScale: config.RETRY_BACKOFF_SCALE,
  onPoisonMessage: (event, error) => workerServices.deadLetters.recordPoisonMessage(event, error),
});
const processor = new DeliveryProcessor({
  db,
  bus,
  health: workerServices.health,
  incidents: workerServices.incidents,
  notifications,
  logger,
  options: { latencyScale: config.SIMULATION_LATENCY_SCALE },
});
bus.subscribe((event) => processor.handle(event).then(() => undefined));

const app = createApp({
  db,
  logger,
  config,
  version: packageJson.version,
  bus,
  notifications,
});
const server = createServer(app);

server.listen(config.PORT, () => {
  logger.info(
    {
      port: config.PORT,
      url: `http://localhost:${config.PORT}${app.graphqlEndpoint}`,
      eventBus: config.EVENT_BUS,
      retryBackoffScale: config.RETRY_BACKOFF_SCALE,
    },
    "api listening",
  );
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal, pendingMessages: bus.pending }, "shutting down");
  server.close();
  bus.close();
  await db.$disconnect();
  process.exit(0);
}

process.once("SIGINT", (signal) => void shutdown(signal));
process.once("SIGTERM", (signal) => void shutdown(signal));
