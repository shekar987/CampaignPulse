import "dotenv/config";

import { DELIVERY_EVENT_STATUS, isTerminalStatus } from "@campaignpulse/shared";

import { loadConfig } from "../src/config";
import { createPrismaClient } from "../src/db/client";
import type { Prisma } from "../src/generated/prisma/client";
import { createLogger } from "../src/logging/logger";
import { LogNotificationPublisher } from "../src/notifications/notification-publisher";
import { HealthService, IncidentService, MetricsService } from "../src/services";
import { DEMO_CAMPAIGNS, generateCampaignEvents, mulberry32, type SeedEvent } from "./seed-data";

const SEED = 20260908;
const BATCH_SIZE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

/**
 * Derives the per-delivery rows (current status, attempts, last error) and the dead-letter
 * entries from a campaign's generated timeline, so the seeded data looks exactly like data the
 * delivery processor would have produced.
 */
function deriveDeliveries(campaignId: string, events: SeedEvent[]) {
  const byCorrelation = new Map<string, SeedEvent[]>();
  for (const event of events) {
    byCorrelation.set(event.correlationId, [
      ...(byCorrelation.get(event.correlationId) ?? []),
      event,
    ]);
  }

  const deliveries: Prisma.DeliveryCreateManyInput[] = [];
  const deadLetters: Prisma.DeadLetterEntryCreateManyInput[] = [];
  for (const [correlationId, chain] of byCorrelation) {
    const first = chain[0]!;
    const last = chain[chain.length - 1]!;
    const status = DELIVERY_EVENT_STATUS[last.eventType] ?? "PENDING";
    const attempts = Math.max(...chain.map((event) => event.attempt));
    const lastFailure = [...chain].reverse().find((event) => event.errorCode);
    deliveries.push({
      correlationId,
      campaignId,
      channel: first.channel,
      status,
      attempts,
      lastErrorCode: status === "SUCCESS" ? null : (lastFailure?.errorCode ?? null),
      lastErrorMessage: status === "SUCCESS" ? null : (lastFailure?.errorMessage ?? null),
      simulation: { runId: "seed", scenario: "CUSTOM", failureRate: 0 },
      requestedAt: first.occurredAt,
      completedAt: isTerminalStatus(status) ? last.occurredAt : null,
    });
    if (status === "FINAL_FAILURE" && lastFailure?.errorCode && lastFailure.errorMessage) {
      deadLetters.push({
        campaignId,
        correlationId,
        channel: first.channel,
        attempts,
        lastErrorCode: lastFailure.errorCode,
        lastErrorMessage: lastFailure.errorMessage,
        reason: "RETRIES_EXHAUSTED",
        payload: { ...last, occurredAt: last.occurredAt.toISOString() } as Prisma.InputJsonObject,
        enqueuedAt: last.occurredAt,
      });
    }
  }
  return { deliveries, deadLetters };
}

/**
 * Replaces all data with the deterministic demo set. Safe to run repeatedly: it wipes the
 * demo tables first, so the result is identical each time apart from timestamps, which are
 * anchored to the moment the seed runs.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger({ level: "info", pretty: config.NODE_ENV === "development" });
  const db = createPrismaClient(config.DATABASE_URL);
  const random = mulberry32(SEED);
  const endAt = new Date(Date.now() - 5 * 60 * 1000);

  try {
    await db.$transaction([
      db.processedEvent.deleteMany(),
      db.deadLetterEntry.deleteMany(),
      db.delivery.deleteMany(),
      db.deliveryEvent.deleteMany(),
      db.incident.deleteMany(),
      db.campaignChannel.deleteMany(),
      db.campaign.deleteMany(),
    ]);

    let totalEvents = 0;
    for (const plan of DEMO_CAMPAIGNS) {
      const campaign = await db.campaign.create({
        data: {
          name: plan.name,
          advertiserName: plan.advertiserName,
          status: plan.status,
          createdAt: new Date(endAt.getTime() - plan.createdDaysAgo * DAY_MS),
          channels: { create: plan.channels.map(({ channel }) => ({ channel })) },
        },
      });

      const events = generateCampaignEvents(plan, { endAt, random });
      for (const batch of chunk(events, BATCH_SIZE)) {
        await db.deliveryEvent.createMany({
          data: batch.map((event) => ({ campaignId: campaign.id, ...event })),
        });
      }
      const { deliveries, deadLetters } = deriveDeliveries(campaign.id, events);
      for (const batch of chunk(deliveries, BATCH_SIZE)) {
        await db.delivery.createMany({ data: batch });
      }
      if (deadLetters.length > 0) {
        await db.deadLetterEntry.createMany({ data: deadLetters });
      }
      totalEvents += events.length;
      logger.info(
        {
          campaignId: campaign.id,
          name: plan.name,
          events: events.length,
          deadLetters: deadLetters.length,
        },
        "seeded campaign",
      );
    }

    const metrics = new MetricsService(db);
    const health = new HealthService(db, metrics, logger);
    const campaigns = await health.recalculateAll();

    // Open incidents for every channel that is degraded or critical, as the processor would.
    const incidents = new IncidentService(
      db,
      metrics,
      new LogNotificationPublisher(logger),
      logger,
    );
    let opened = 0;
    for (const channel of await db.campaignChannel.findMany()) {
      const evaluation = await incidents.evaluateChannel(channel.campaignId, channel.channel);
      if (evaluation.action === "created") {
        opened += 1;
      }
    }

    logger.info({ campaigns, events: totalEvents, incidents: opened }, "seed complete");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
