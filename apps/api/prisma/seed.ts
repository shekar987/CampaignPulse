import "dotenv/config";

import { loadConfig } from "../src/config";
import { createPrismaClient } from "../src/db/client";
import { createLogger } from "../src/logging/logger";
import { HealthService, MetricsService } from "../src/services";
import { DEMO_CAMPAIGNS, generateCampaignEvents, mulberry32 } from "./seed-data";

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
      totalEvents += events.length;
      logger.info(
        { campaignId: campaign.id, name: plan.name, events: events.length },
        "seeded campaign",
      );
    }

    const health = new HealthService(db, new MetricsService(db), logger);
    const campaigns = await health.recalculateAll();
    logger.info({ campaigns, events: totalEvents }, "seed complete");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
