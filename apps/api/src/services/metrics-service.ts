import type { Channel } from "@campaignpulse/event-contracts";
import {
  FAILURE_EVENT_TYPES,
  SUCCESS_EVENT_TYPES,
  classifyOutcome,
  type OutcomeCounts,
} from "@campaignpulse/shared";

import type { PrismaClient } from "../db/client";

const OUTCOME_EVENT_TYPES = [...SUCCESS_EVENT_TYPES, ...FAILURE_EVENT_TYPES];

export interface MetricsWindow {
  /** Only count events that occurred at or after this instant. */
  since?: Date;
}

export type ChannelCounts = Map<Channel, OutcomeCounts>;

function emptyCounts(): Required<OutcomeCounts> {
  return { successes: 0, failures: 0, latencySumMs: 0, latencySamples: 0 };
}

/**
 * Aggregates delivery outcome counts from `delivery_events`. Everything is a single grouped
 * query per call, so listing a page of campaigns costs one aggregation rather than one per
 * campaign or channel.
 */
export class MetricsService {
  constructor(private readonly db: PrismaClient) {}

  /** Outcome counts keyed by campaign id, then by channel. */
  async countsByCampaignChannel(
    campaignIds: readonly string[],
    window: MetricsWindow = {},
  ): Promise<Map<string, ChannelCounts>> {
    const result = new Map<string, ChannelCounts>();
    if (campaignIds.length === 0) {
      return result;
    }

    const rows = await this.db.deliveryEvent.groupBy({
      by: ["campaignId", "channel", "eventType"],
      where: {
        campaignId: { in: [...campaignIds] },
        eventType: { in: OUTCOME_EVENT_TYPES },
        ...(window.since ? { occurredAt: { gte: window.since } } : {}),
      },
      _count: { _all: true, latencyMs: true },
      _sum: { latencyMs: true },
    });

    for (const row of rows) {
      const outcome = classifyOutcome(row.eventType);
      if (!outcome) {
        continue;
      }
      let byChannel = result.get(row.campaignId);
      if (!byChannel) {
        byChannel = new Map();
        result.set(row.campaignId, byChannel);
      }
      const counts =
        (byChannel.get(row.channel) as Required<OutcomeCounts> | undefined) ?? emptyCounts();
      if (outcome === "success") {
        counts.successes += row._count._all;
      } else {
        counts.failures += row._count._all;
      }
      counts.latencySumMs += row._sum.latencyMs ?? 0;
      counts.latencySamples += row._count.latencyMs;
      byChannel.set(row.channel, counts);
    }

    return result;
  }

  /** System-wide outcome counts keyed by channel. */
  async countsByChannel(window: MetricsWindow = {}): Promise<ChannelCounts> {
    const rows = await this.db.deliveryEvent.groupBy({
      by: ["channel", "eventType"],
      where: {
        eventType: { in: OUTCOME_EVENT_TYPES },
        ...(window.since ? { occurredAt: { gte: window.since } } : {}),
      },
      _count: { _all: true, latencyMs: true },
      _sum: { latencyMs: true },
    });

    const result: ChannelCounts = new Map();
    for (const row of rows) {
      const outcome = classifyOutcome(row.eventType);
      if (!outcome) {
        continue;
      }
      const counts =
        (result.get(row.channel) as Required<OutcomeCounts> | undefined) ?? emptyCounts();
      if (outcome === "success") {
        counts.successes += row._count._all;
      } else {
        counts.failures += row._count._all;
      }
      counts.latencySumMs += row._sum.latencyMs ?? 0;
      counts.latencySamples += row._count.latencyMs;
      result.set(row.channel, counts);
    }
    return result;
  }
}
