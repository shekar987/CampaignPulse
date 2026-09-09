import { calculateHealth, classifyOutcome, worstHealth } from "@campaignpulse/shared";
import { describe, expect, it } from "vitest";

import {
  DEMO_CAMPAIGNS,
  generateCampaignEvents,
  mulberry32,
  type CampaignPlan,
} from "../prisma/seed-data";

const endAt = new Date("2026-09-08T12:00:00.000Z");

function outcomes(plan: CampaignPlan) {
  const events = generateCampaignEvents(plan, { endAt, random: mulberry32(1) });
  const counts = new Map<string, { successes: number; failures: number }>();
  for (const event of events) {
    const outcome = classifyOutcome(event.eventType);
    if (!outcome) {
      continue;
    }
    const entry = counts.get(event.channel) ?? { successes: 0, failures: 0 };
    entry[outcome === "success" ? "successes" : "failures"] += 1;
    counts.set(event.channel, entry);
  }
  return { events, counts };
}

function plan(slug: string): CampaignPlan {
  const found = DEMO_CAMPAIGNS.find((candidate) => candidate.slug === slug);
  if (!found) {
    throw new Error(`No demo campaign with slug ${slug}`);
  }
  return found;
}

describe("demo seed data", () => {
  it("produces exactly the planned outcome counts for every campaign", () => {
    for (const campaign of DEMO_CAMPAIGNS) {
      const { counts } = outcomes(campaign);
      for (const channel of campaign.channels) {
        const actual = counts.get(channel.channel) ?? { successes: 0, failures: 0 };
        expect(actual, `${campaign.slug}/${channel.channel}`).toEqual({
          successes: channel.successes,
          failures: channel.failures,
        });
      }
    }
  });

  it.each([
    ["autumn-homeware", "HEALTHY"],
    ["back-to-school", "DEGRADED"],
    ["summer-drinks", "CRITICAL"],
    ["winter-warmers", "UNKNOWN"],
  ] as const)("%s seeds the %s scenario", (slug, expected) => {
    const campaign = plan(slug);
    const channelHealth = campaign.channels.map((channel) =>
      calculateHealth(channel.successes + channel.failures, channel.failures),
    );
    expect(worstHealth(channelHealth)).toBe(expected);
  });

  it("is deterministic for the same seed", () => {
    const first = generateCampaignEvents(plan("summer-drinks"), { endAt, random: mulberry32(7) });
    const second = generateCampaignEvents(plan("summer-drinks"), { endAt, random: mulberry32(7) });
    expect(second).toEqual(first);
  });

  it("emits a retry chain that fails twice and succeeds on the third attempt", () => {
    const { events } = outcomes(plan("summer-drinks"));
    const byCorrelation = new Map<string, typeof events>();
    for (const event of events) {
      byCorrelation.set(event.correlationId, [
        ...(byCorrelation.get(event.correlationId) ?? []),
        event,
      ]);
    }
    const chain = [...byCorrelation.values()].find((chainEvents) =>
      chainEvents.some((event) => event.eventType === "DELIVERY_RETRY_SUCCEEDED"),
    );
    expect(chain).toBeDefined();
    expect(chain?.map((event) => event.eventType)).toEqual([
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
    expect(chain?.map((event) => event.attempt)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3]);
  });

  it("emits a dead-letter chain ending in a final failure marker", () => {
    const { events } = outcomes(plan("summer-drinks"));
    const finalFailure = events.find((event) => event.eventType === "DELIVERY_FINAL_FAILURE");
    expect(finalFailure).toBeDefined();
    const chain = events.filter((event) => event.correlationId === finalFailure?.correlationId);
    expect(chain.filter((event) => event.eventType === "DELIVERY_FAILED")).toHaveLength(3);
    expect(chain.at(-1)?.status).toBe("FINAL_FAILURE");
  });

  it("orders events chronologically and never before the window start", () => {
    const { events } = outcomes(plan("fresh-fruit-fortnight"));
    for (let i = 1; i < events.length; i += 1) {
      expect(events[i]!.occurredAt.getTime()).toBeGreaterThanOrEqual(
        events[i - 1]!.occurredAt.getTime(),
      );
    }
    expect(events[0]!.occurredAt.getTime()).toBeGreaterThanOrEqual(
      endAt.getTime() - 6 * 60 * 60 * 1000,
    );
  });

  it("attaches an error code and message to every failed attempt", () => {
    const { events } = outcomes(plan("pet-care-essentials"));
    const failures = events.filter((event) => event.eventType === "DELIVERY_FAILED");
    expect(failures.length).toBeGreaterThan(0);
    for (const failure of failures) {
      expect(failure.errorCode).not.toBeNull();
      expect(failure.errorMessage).toBeTruthy();
      expect(failure.latencyMs).toBeGreaterThan(0);
    }
  });
});
