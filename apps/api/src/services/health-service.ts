import type { Channel, HealthStatus } from "@campaignpulse/event-contracts";
import { calculateHealth, worstHealth } from "@campaignpulse/shared";

import type { PrismaClient } from "../db/client";
import type { Logger } from "../logging/logger";
import { NotFoundError } from "./errors";
import type { MetricsService } from "./metrics-service";

export interface ChannelHealthChange {
  channel: Channel;
  previous: HealthStatus;
  current: HealthStatus;
}

export interface CampaignHealthResult {
  campaignId: string;
  previous: HealthStatus;
  current: HealthStatus;
  channels: ChannelHealthChange[];
}

/**
 * Derives and persists health for a campaign and each of its channels from all-time outcome
 * counts. Runs after seeding and, from the event-processing phase onward, after every batch of
 * delivery events. Transitions are logged so incident detection can build on the same signal.
 */
export class HealthService {
  constructor(
    private readonly db: PrismaClient,
    private readonly metrics: MetricsService,
    private readonly logger: Logger,
  ) {}

  async recalculateCampaign(campaignId: string): Promise<CampaignHealthResult> {
    const campaign = await this.db.campaign.findUnique({
      where: { id: campaignId },
      include: { channels: true },
    });
    if (!campaign) {
      throw new NotFoundError("Campaign", campaignId);
    }

    const countsByChannel =
      (await this.metrics.countsByCampaignChannel([campaignId])).get(campaignId) ?? new Map();

    const channels: (ChannelHealthChange & { id: string })[] = campaign.channels.map((row) => {
      const counts = countsByChannel.get(row.channel);
      const current = counts
        ? calculateHealth(counts.successes + counts.failures, counts.failures)
        : "UNKNOWN";
      return { id: row.id, channel: row.channel, previous: row.healthStatus, current };
    });
    const current = worstHealth(channels.map((entry) => entry.current));

    await this.db.$transaction([
      ...channels
        .filter((entry) => entry.previous !== entry.current)
        .map((entry) =>
          this.db.campaignChannel.update({
            where: { id: entry.id },
            data: { healthStatus: entry.current },
          }),
        ),
      this.db.campaign.update({ where: { id: campaignId }, data: { healthStatus: current } }),
    ]);

    for (const entry of channels) {
      if (entry.previous !== entry.current) {
        this.logger.info(
          {
            campaignId,
            channel: entry.channel,
            previousHealth: entry.previous,
            currentHealth: entry.current,
          },
          "channel health changed",
        );
      }
    }

    return {
      campaignId,
      previous: campaign.healthStatus,
      current,
      channels: channels.map(({ channel, previous, current: now }) => ({
        channel,
        previous,
        current: now,
      })),
    };
  }

  /** Recalculates every campaign. Returns the number of campaigns processed. */
  async recalculateAll(): Promise<number> {
    const campaigns = await this.db.campaign.findMany({ select: { id: true } });
    for (const { id } of campaigns) {
      await this.recalculateCampaign(id);
    }
    return campaigns.length;
  }
}
