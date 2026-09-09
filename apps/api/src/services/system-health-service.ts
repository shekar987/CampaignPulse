import { CHANNELS, type Channel, type HealthStatus } from "@campaignpulse/event-contracts";
import {
  calculateHealth,
  computeMetrics,
  mergeOutcomeCounts,
  type DeliveryMetrics,
} from "@campaignpulse/shared";

import type { PrismaClient } from "../db/client";
import type { CampaignService, CampaignView } from "./campaign-service";
import type { DeadLetterService } from "./dead-letter-service";
import type { IncidentService } from "./incident-service";
import type { MetricsService } from "./metrics-service";

export interface ChannelHealthView {
  channel: Channel;
  healthStatus: HealthStatus;
  metrics: DeliveryMetrics;
}

export interface HealthCounts {
  healthy: number;
  degraded: number;
  critical: number;
  unknown: number;
}

export interface SystemHealthSnapshot {
  windowHours: number;
  generatedAt: Date;
  channels: ChannelHealthView[];
  campaigns: HealthCounts;
  delivery: DeliveryMetrics;
  attention: CampaignView[];
  openIncidents: number;
  deadLetterCount: number;
}

/** Rolling window for the overview page. A demo assumption, documented in docs/decisions.md. */
export const SYSTEM_HEALTH_WINDOW_HOURS = 24;
const ATTENTION_LIMIT = 5;

export class SystemHealthService {
  constructor(
    private readonly db: PrismaClient,
    private readonly metrics: MetricsService,
    private readonly campaigns: CampaignService,
    private readonly incidents: IncidentService,
    private readonly deadLetters: DeadLetterService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getSnapshot(): Promise<SystemHealthSnapshot> {
    const generatedAt = this.now();
    const since = new Date(generatedAt.getTime() - SYSTEM_HEALTH_WINDOW_HOURS * 60 * 60 * 1000);

    const [countsByChannel, campaignGroups, attention, openIncidents, deadLetterCount] =
      await Promise.all([
        this.metrics.countsByChannel({ since }),
        this.db.campaign.groupBy({ by: ["healthStatus"], _count: { _all: true } }),
        this.campaigns.listNeedingAttention(ATTENTION_LIMIT),
        this.incidents.countActive(),
        this.deadLetters.countPending(),
      ]);

    const channels: ChannelHealthView[] = CHANNELS.map((channel) => {
      const counts = countsByChannel.get(channel) ?? { successes: 0, failures: 0 };
      return {
        channel,
        healthStatus: calculateHealth(counts.successes + counts.failures, counts.failures),
        metrics: computeMetrics(counts),
      };
    });

    const campaigns: HealthCounts = { healthy: 0, degraded: 0, critical: 0, unknown: 0 };
    for (const group of campaignGroups) {
      const key = group.healthStatus.toLowerCase() as keyof HealthCounts;
      campaigns[key] = group._count._all;
    }

    return {
      windowHours: SYSTEM_HEALTH_WINDOW_HOURS,
      generatedAt,
      channels,
      campaigns,
      delivery: computeMetrics(mergeOutcomeCounts([...countsByChannel.values()])),
      attention,
      openIncidents,
      deadLetterCount,
    };
  }
}
