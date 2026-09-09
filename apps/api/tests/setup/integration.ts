import { pino } from "pino";

import { createPrismaClient, type PrismaClient } from "../../src/db/client";
import { LocalEventBus } from "../../src/events/local-event-bus";
import type {
  Notification,
  NotificationPublisher,
} from "../../src/notifications/notification-publisher";
import {
  DeliveryProcessor,
  type DeliveryProcessorOptions,
} from "../../src/processing/delivery-processor";
import { SystemService, buildServices, type Services } from "../../src/services";

export const databaseUrl = process.env.DATABASE_URL_TEST;

/** Records notifications so tests can assert on alerting without any transport. */
export class RecordingNotifications implements NotificationPublisher {
  readonly published: Notification[] = [];

  async publish(notification: Notification): Promise<void> {
    this.published.push(notification);
  }
}

export interface IntegrationHarness {
  db: PrismaClient;
  bus: LocalEventBus;
  services: Services;
  notifications: RecordingNotifications;
  processor: DeliveryProcessor;
  /** Waits until every published message has been processed. */
  drain: () => Promise<void>;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

export interface HarnessOptions {
  duplicateDeliveries?: number;
  concurrency?: number;
  processor?: DeliveryProcessorOptions;
}

/**
 * The full local stack against a real PostgreSQL database: in-memory bus, delivery processor,
 * services. Retry backoff and simulated latency are compressed to keep tests fast.
 */
export async function createHarness(options: HarnessOptions = {}): Promise<IntegrationHarness> {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_TEST is not set");
  }
  const logger = pino({ level: "silent" });
  const db = createPrismaClient(databaseUrl);
  const notifications = new RecordingNotifications();
  const system = new SystemService({ version: "test", environment: "test" });

  const bus = new LocalEventBus({
    logger,
    delayScale: 0,
    concurrency: options.concurrency ?? 2,
    duplicateDeliveries: options.duplicateDeliveries,
    onPoisonMessage: (event, error) => services.deadLetters.recordPoisonMessage(event, error),
  });
  const services = buildServices({ db, logger, system, notifications, bus });
  const processor = new DeliveryProcessor({
    db,
    bus,
    health: services.health,
    incidents: services.incidents,
    notifications,
    logger,
    options: { latencyScale: 0, sleep: async () => {}, ...options.processor },
  });
  bus.subscribe((event) => processor.handle(event).then(() => undefined));

  const reset = async () => {
    notifications.published.length = 0;
    await db.$transaction([
      db.processedEvent.deleteMany(),
      db.deadLetterEntry.deleteMany(),
      db.delivery.deleteMany(),
      db.deliveryEvent.deleteMany(),
      db.incident.deleteMany(),
      db.campaignChannel.deleteMany(),
      db.campaign.deleteMany(),
    ]);
  };

  return {
    db,
    bus,
    services,
    notifications,
    processor,
    drain: () => bus.idle(),
    reset,
    close: async () => {
      bus.close();
      await db.$disconnect();
    },
  };
}
