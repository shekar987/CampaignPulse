import type { DeliveryEvent } from "@campaignpulse/event-contracts";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createEvent } from "../../src/events/event-mapper";
import { createHarness, databaseUrl, type IntegrationHarness } from "../setup/integration";

describe.skipIf(!databaseUrl)("delivery pipeline (PostgreSQL)", () => {
  let harness: IntegrationHarness;

  beforeAll(async () => {
    harness = await createHarness();
  });

  beforeEach(async () => {
    await harness.reset();
  });

  afterEach(async () => {
    await harness.drain();
  });

  afterAll(async () => {
    await harness.close();
  });

  async function createCampaign(channels: ("WEB" | "SMARTSHOP")[] = ["WEB", "SMARTSHOP"]) {
    return harness.services.campaigns.create({
      name: "Pipeline Test",
      advertiserName: "Test Advertiser",
      channels,
    });
  }

  it("runs a healthy scenario end to end: events, deliveries, health", async () => {
    const campaign = await createCampaign(["WEB"]);
    const run = await harness.services.simulation.run({
      campaignId: campaign.id,
      scenario: "HEALTHY",
      seed: 1,
    });
    expect(run.deliveries).toBe(100);
    await harness.drain();

    const deliveries = await harness.db.delivery.findMany({ where: { campaignId: campaign.id } });
    expect(deliveries).toHaveLength(100);
    expect(deliveries.every((delivery) => delivery.status === "SUCCESS")).toBe(true);

    const view = await harness.services.campaigns.getById(campaign.id);
    const web = view.channels.find((channel) => channel.channel === "WEB");
    expect(web?.healthStatus).toBe("HEALTHY");
    // 100 deliveries, one of which failed once and succeeded on retry.
    expect(web?.metrics.successfulEvents).toBe(100);
    expect(web?.metrics.failedEvents).toBe(1);
    // The single failure briefly reads as a high error rate while the sample is tiny; incident
    // detection waits for volume, so no incident opens on a healthy channel.
    expect(view.openIncidentCount).toBe(0);
    expect(await harness.services.incidents.countActive(campaign.id)).toBe(0);
    expect(harness.notifications.published).toEqual([]);
  });

  it("does not open an incident for failures on a channel with too few attempts", async () => {
    const campaign = await createCampaign(["WEB"]);
    await harness.services.simulation.run({
      campaignId: campaign.id,
      scenario: "CUSTOM",
      deliveries: 10,
      failureRate: 0.5,
      seed: 12,
    });
    await harness.drain();
    const view = await harness.services.campaigns.getById(campaign.id);
    expect(view.channels[0]?.healthStatus).toBe("CRITICAL");
    expect(await harness.services.incidents.countActive(campaign.id)).toBe(0);
  });

  it("opens a critical incident and notifies when the error rate crosses the threshold", async () => {
    const campaign = await createCampaign(["SMARTSHOP"]);
    await harness.services.simulation.run({
      campaignId: campaign.id,
      scenario: "CRITICAL",
      seed: 2,
    });
    await harness.drain();

    const view = await harness.services.campaigns.getById(campaign.id);
    const smartshop = view.channels.find((channel) => channel.channel === "SMARTSHOP");
    expect(smartshop?.healthStatus).toBe("CRITICAL");
    expect(view.healthStatus).toBe("CRITICAL");

    const incidents = await harness.services.incidents.list({
      campaignId: campaign.id,
      page: 1,
      pageSize: 10,
    });
    expect(incidents.totalCount).toBe(1);
    const incident = incidents.items[0]!;
    expect(incident).toMatchObject({
      channel: "SMARTSHOP",
      status: "OPEN",
      severity: "CRITICAL",
      title: "SmartShop delivery failures",
    });
    expect(incident.errorRateAtDetection).toBeGreaterThanOrEqual(0.1);

    const created = harness.notifications.published.filter((n) => n.type === "INCIDENT_CREATED");
    expect(created).toHaveLength(1);
    expect(created[0]?.attributes).toMatchObject({ campaignId: campaign.id, channel: "SMARTSHOP" });

    const timeline = await harness.services.events.list({
      campaignId: campaign.id,
      correlationId: `incident-${incident.id}`,
      page: 1,
      pageSize: 10,
    });
    expect(timeline.items.map((event) => event.eventType)).toEqual(["INCIDENT_CREATED"]);
  });

  it("retries transient failures with backoff and succeeds on the third attempt", async () => {
    const campaign = await createCampaign(["WEB"]);
    await harness.services.simulation.run({
      campaignId: campaign.id,
      scenario: "RETRY_SUCCESS",
      seed: 3,
    });
    await harness.drain();

    const [delivery] = await harness.db.delivery.findMany({ where: { campaignId: campaign.id } });
    expect(delivery).toMatchObject({ status: "SUCCESS", attempts: 3 });

    const events = await harness.db.deliveryEvent.findMany({
      where: { correlationId: delivery!.correlationId },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    });
    expect(events.map((event) => event.eventType)).toEqual([
      "CAMPAIGN_DELIVERY_REQUESTED",
      "DELIVERY_STARTED",
      "DELIVERY_FAILED",
      "DELIVERY_RETRY_REQUESTED",
      "DELIVERY_STARTED",
      "DELIVERY_FAILED",
      "DELIVERY_RETRY_REQUESTED",
      "DELIVERY_STARTED",
      "DELIVERY_RETRY_SUCCEEDED",
    ]);
    expect(events.map((event) => event.attempt)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
    const retries = events.filter((event) => event.eventType === "DELIVERY_RETRY_REQUESTED");
    expect(
      retries.map((event) => (event.metadata as { delaySeconds: number }).delaySeconds),
    ).toEqual([5, 30]);
    expect(await harness.db.deadLetterEntry.count()).toBe(0);
  });

  it("dead-letters a delivery after the maximum attempts and records the final failure", async () => {
    const campaign = await createCampaign(["SMARTSHOP"]);
    await harness.services.simulation.run({
      campaignId: campaign.id,
      scenario: "DEAD_LETTER",
      seed: 4,
    });
    await harness.drain();

    const [delivery] = await harness.db.delivery.findMany({ where: { campaignId: campaign.id } });
    expect(delivery).toMatchObject({ status: "FINAL_FAILURE", attempts: 3 });

    const entries = await harness.services.deadLetters.list({
      campaignId: campaign.id,
      page: 1,
      pageSize: 10,
    });
    expect(entries.totalCount).toBe(1);
    expect(entries.items[0]).toMatchObject({
      correlationId: delivery!.correlationId,
      attempts: 3,
      reason: "RETRIES_EXHAUSTED",
      status: "PENDING",
      lastError: { code: "NETWORK_ERROR" },
    });

    const finalFailure = await harness.db.deliveryEvent.findFirst({
      where: { correlationId: delivery!.correlationId, eventType: "DELIVERY_FINAL_FAILURE" },
    });
    expect(finalFailure?.status).toBe("FINAL_FAILURE");
    expect(harness.notifications.published.some((n) => n.type === "DELIVERY_DEAD_LETTERED")).toBe(
      true,
    );
  });

  it("dead-letters a non-retryable error immediately", async () => {
    const campaign = await createCampaign(["WEB"]);
    await harness.services.simulation.run({
      campaignId: campaign.id,
      scenario: "NON_RETRYABLE",
      seed: 5,
    });
    await harness.drain();

    const [delivery] = await harness.db.delivery.findMany({ where: { campaignId: campaign.id } });
    expect(delivery).toMatchObject({ status: "FINAL_FAILURE", attempts: 1 });
    const [entry] = (
      await harness.services.deadLetters.list({ campaignId: campaign.id, page: 1, pageSize: 5 })
    ).items;
    expect(entry).toMatchObject({
      reason: "NON_RETRYABLE_ERROR",
      lastError: { code: "VALIDATION_ERROR" },
    });
    expect(
      await harness.db.deliveryEvent.count({ where: { eventType: "DELIVERY_RETRY_REQUESTED" } }),
    ).toBe(0);
  });

  it("replays dead-lettered deliveries as new workflows and marks the entries replayed", async () => {
    const campaign = await createCampaign(["SMARTSHOP"]);
    await harness.services.simulation.run({
      campaignId: campaign.id,
      scenario: "DEAD_LETTER",
      seed: 6,
    });
    await harness.drain();

    const result = await harness.services.deadLetters.replay(campaign.id);
    expect(result.replayed).toBe(1);
    await harness.drain();

    const replayId = result.correlationIds[0]!;
    expect(replayId).toMatch(/-r1$/);
    const replay = await harness.db.delivery.findUnique({ where: { correlationId: replayId } });
    expect(replay).toMatchObject({ status: "SUCCESS", attempts: 1 });

    const entries = await harness.services.deadLetters.list({
      campaignId: campaign.id,
      page: 1,
      pageSize: 10,
    });
    expect(entries.items[0]).toMatchObject({ status: "REPLAYED", replayCorrelationId: replayId });
    expect(await harness.services.deadLetters.countPending(campaign.id)).toBe(0);

    // The original delivery keeps its terminal state.
    const original = await harness.db.delivery.findUnique({
      where: { correlationId: entries.items[0]!.correlationId },
    });
    expect(original?.status).toBe("FINAL_FAILURE");
    expect(await harness.services.deadLetters.replay(campaign.id)).toEqual({
      replayed: 0,
      correlationIds: [],
    });
  });

  it("acknowledges and resolves an incident, and refuses to resolve twice", async () => {
    const campaign = await createCampaign(["SMARTSHOP"]);
    await harness.services.simulation.run({
      campaignId: campaign.id,
      scenario: "CRITICAL",
      seed: 7,
    });
    await harness.drain();
    const [incident] = (
      await harness.services.incidents.list({ campaignId: campaign.id, page: 1, pageSize: 5 })
    ).items;

    const acknowledged = await harness.services.incidents.acknowledge(incident!.id);
    expect(acknowledged.status).toBe("ACKNOWLEDGED");
    expect(acknowledged.acknowledgedAt).not.toBeNull();
    await expect(harness.services.incidents.acknowledge(incident!.id)).rejects.toThrow(
      "Only open incidents can be acknowledged",
    );

    const resolved = await harness.services.incidents.resolve(incident!.id, "Dependency recovered");
    expect(resolved).toMatchObject({ status: "RESOLVED", resolutionNote: "Dependency recovered" });
    await expect(harness.services.incidents.resolve(incident!.id)).rejects.toThrow(
      "already resolved",
    );

    const timeline = await harness.services.events.list({
      campaignId: campaign.id,
      correlationId: `incident-${incident!.id}`,
      page: 1,
      pageSize: 10,
    });
    expect(timeline.items.map((event) => event.eventType)).toEqual([
      "INCIDENT_RESOLVED",
      "INCIDENT_ACKNOWLEDGED",
      "INCIDENT_CREATED",
    ]);

    // Once resolved, a channel that is still critical opens a fresh incident on the next evaluation.
    const evaluation = await harness.services.incidents.evaluateChannel(campaign.id, "SMARTSHOP");
    expect(evaluation.action).toBe("created");
  });

  it("escalates a warning incident to critical when health worsens", async () => {
    const campaign = await createCampaign(["WEB"]);
    await harness.services.simulation.run({
      campaignId: campaign.id,
      scenario: "DEGRADED",
      seed: 8,
    });
    await harness.drain();
    let [incident] = (
      await harness.services.incidents.list({ campaignId: campaign.id, page: 1, pageSize: 5 })
    ).items;
    expect(incident?.severity).toBe("WARNING");

    await harness.services.simulation.run({
      campaignId: campaign.id,
      scenario: "CUSTOM",
      deliveries: 100,
      failureRate: 0.5,
      seed: 9,
    });
    await harness.drain();
    [incident] = (
      await harness.services.incidents.list({ campaignId: campaign.id, page: 1, pageSize: 5 })
    ).items;
    expect(incident?.severity).toBe("CRITICAL");
    expect(incident?.status).toBe("OPEN");
    expect(
      harness.notifications.published.filter((n) => n.type === "INCIDENT_ESCALATED"),
    ).toHaveLength(1);
    expect(await harness.db.incident.count({ where: { campaignId: campaign.id } })).toBe(1);
  });

  it("activates a draft campaign on its first simulation", async () => {
    const campaign = await createCampaign(["WEB"]);
    await harness.db.campaign.update({ where: { id: campaign.id }, data: { status: "DRAFT" } });
    await harness.services.simulation.run({
      campaignId: campaign.id,
      scenario: "HEALTHY",
      seed: 10,
    });
    expect((await harness.db.campaign.findUnique({ where: { id: campaign.id } }))?.status).toBe(
      "ACTIVE",
    );
    await harness.drain();
  });

  it("rejects channels the campaign is not configured for", async () => {
    const campaign = await createCampaign(["WEB"]);
    await expect(
      harness.services.simulation.run({
        campaignId: campaign.id,
        scenario: "HEALTHY",
        channels: ["SMARTSHOP"],
      }),
    ).rejects.toThrow("Simulation request is invalid");
  });

  it("ignores a stale retry for a delivery that already succeeded", async () => {
    const campaign = await createCampaign(["WEB"]);
    await harness.services.simulation.run({
      campaignId: campaign.id,
      scenario: "RETRY_SUCCESS",
      seed: 11,
    });
    await harness.drain();
    const [delivery] = await harness.db.delivery.findMany({ where: { campaignId: campaign.id } });

    const stale: DeliveryEvent = createEvent({
      campaignId: campaign.id,
      correlationId: delivery!.correlationId,
      eventType: "DELIVERY_RETRY_REQUESTED",
      channel: "WEB",
      status: "RETRYING",
      attempt: 3,
      occurredAt: new Date(),
    });
    const result = await harness.processor.handle(stale);
    expect(result.status).toBe("ignored");
    expect(
      (await harness.db.delivery.findUnique({ where: { correlationId: delivery!.correlationId } }))
        ?.status,
    ).toBe("SUCCESS");
    expect(
      await harness.db.deliveryEvent.count({ where: { correlationId: delivery!.correlationId } }),
    ).toBe(9);
  });
});
