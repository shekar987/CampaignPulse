import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createHarness, databaseUrl, type IntegrationHarness } from "../setup/integration";

/**
 * The transport delivers every message twice here, mimicking SQS at-least-once delivery. The
 * database must end up exactly as it would with single delivery.
 */
describe.skipIf(!databaseUrl)("idempotent processing under duplicate delivery (PostgreSQL)", () => {
  let harness: IntegrationHarness;

  beforeAll(async () => {
    harness = await createHarness({ duplicateDeliveries: 2, concurrency: 4 });
  });

  beforeEach(async () => {
    await harness.reset();
  });

  afterAll(async () => {
    await harness.close();
  });

  it("processes each event once even when every message arrives twice", async () => {
    const campaign = await harness.services.campaigns.create({
      name: "Duplicates",
      advertiserName: "Test",
      channels: ["WEB"],
    });
    await harness.services.simulation.run({
      campaignId: campaign.id,
      scenario: "DEGRADED",
      seed: 21,
    });
    await harness.drain();

    const deliveries = await harness.db.delivery.findMany({ where: { campaignId: campaign.id } });
    expect(deliveries).toHaveLength(100);
    expect(deliveries.every((delivery) => delivery.status === "SUCCESS")).toBe(true);

    // 100 requested + 100 started + 100 succeeded on first attempt, plus for the 6 failing ones:
    // failed + retry requested + started + retry succeeded, minus their first-attempt success.
    const counts = await harness.db.deliveryEvent.groupBy({
      by: ["eventType"],
      where: { campaignId: campaign.id },
      _count: { _all: true },
    });
    const byType = Object.fromEntries(counts.map((row) => [row.eventType, row._count._all]));
    expect(byType).toEqual({
      CAMPAIGN_DELIVERY_REQUESTED: 100,
      DELIVERY_STARTED: 106,
      DELIVERY_SUCCEEDED: 94,
      DELIVERY_FAILED: 6,
      DELIVERY_RETRY_REQUESTED: 6,
      DELIVERY_RETRY_SUCCEEDED: 6,
      INCIDENT_CREATED: 1,
    });

    const view = await harness.services.campaigns.getById(campaign.id);
    expect(view.channels[0]?.metrics).toMatchObject({ successfulEvents: 100, failedEvents: 6 });
    expect(await harness.db.processedEvent.count()).toBe(106);
    expect(await harness.db.incident.count({ where: { campaignId: campaign.id } })).toBe(1);
  });

  it("records a poison message in the dead-letter queue after repeated processing failures", async () => {
    const campaign = await harness.services.campaigns.create({
      name: "Poison",
      advertiserName: "Test",
      channels: ["WEB"],
    });
    // Malformed: attempt 0 fails schema validation every time it is delivered.
    await harness.bus.publish({
      id: "0192b1c2-7f3e-7a4b-9c1d-2e3f4a5b6c99",
      campaignId: campaign.id,
      correlationId: "cmp-poison-0001",
      eventType: "CAMPAIGN_DELIVERY_REQUESTED",
      channel: "WEB",
      status: "PENDING",
      attempt: 0,
      occurredAt: new Date().toISOString(),
    });
    await harness.drain();

    const entries = await harness.services.deadLetters.list({
      campaignId: campaign.id,
      page: 1,
      pageSize: 5,
    });
    expect(entries.totalCount).toBe(1);
    expect(entries.items[0]).toMatchObject({
      correlationId: "cmp-poison-0001",
      reason: "PROCESSING_FAILURE",
      status: "PENDING",
    });
    expect(harness.notifications.published.some((n) => n.type === "DELIVERY_DEAD_LETTERED")).toBe(
      true,
    );
  });
});
