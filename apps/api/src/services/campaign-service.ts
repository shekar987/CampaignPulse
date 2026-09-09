import {
  CHANNELS,
  type CampaignStatus,
  type Channel,
  type HealthStatus,
} from "@campaignpulse/event-contracts";
import {
  computeMetrics,
  createCampaignSchema,
  mergeOutcomeCounts,
  type DeliveryMetrics,
} from "@campaignpulse/shared";

import type { PrismaClient } from "../db/client";
import type { Prisma } from "../generated/prisma/client";
import type { Logger } from "../logging/logger";
import { NotFoundError, ValidationError } from "./errors";
import type { ChannelCounts, MetricsService } from "./metrics-service";
import { buildPage, toSkipTake, type Page, type PageParams } from "./pagination";

export interface CampaignChannelView {
  id: string;
  channel: Channel;
  healthStatus: HealthStatus;
  metrics: DeliveryMetrics;
}

export interface CampaignView {
  id: string;
  name: string;
  advertiserName: string;
  status: CampaignStatus;
  healthStatus: HealthStatus;
  channels: CampaignChannelView[];
  metrics: DeliveryMetrics;
  /** Incidents that are open or acknowledged. */
  openIncidentCount: number;
  /** Dead-lettered deliveries waiting to be replayed or discarded. */
  deadLetterCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CampaignHealthView {
  campaignId: string;
  overall: HealthStatus;
  channels: CampaignChannelView[];
}

export type CampaignSort = "NEWEST" | "OLDEST" | "NAME";

export interface CampaignListParams extends PageParams {
  search?: string;
  healthStatus?: HealthStatus;
  channel?: Channel;
  sort: CampaignSort;
}

type CampaignRow = Prisma.CampaignGetPayload<{ include: { channels: true } }>;

const CHANNEL_ORDER = new Map<Channel, number>(CHANNELS.map((channel, index) => [channel, index]));
const HEALTH_SEVERITY_ORDER: HealthStatus[] = ["CRITICAL", "DEGRADED"];

export class CampaignService {
  constructor(
    private readonly db: PrismaClient,
    private readonly metrics: MetricsService,
    private readonly logger: Logger,
  ) {}

  async list(params: CampaignListParams): Promise<Page<CampaignView>> {
    const where: Prisma.CampaignWhereInput = {
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: "insensitive" } },
              { advertiserName: { contains: params.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(params.healthStatus ? { healthStatus: params.healthStatus } : {}),
      ...(params.channel ? { channels: { some: { channel: params.channel } } } : {}),
    };

    const orderBy: Prisma.CampaignOrderByWithRelationInput[] =
      params.sort === "NAME"
        ? [{ name: "asc" }, { createdAt: "desc" }]
        : [{ createdAt: params.sort === "NEWEST" ? "desc" : "asc" }, { id: "asc" }];

    const [totalCount, rows] = await this.db.$transaction([
      this.db.campaign.count({ where }),
      this.db.campaign.findMany({
        where,
        orderBy,
        ...toSkipTake(params),
        include: { channels: true },
      }),
    ]);

    const items = await this.toViews(rows);
    return buildPage(items, totalCount, params);
  }

  /** Degraded and critical campaigns, most severe first, for the overview page. */
  async listNeedingAttention(limit: number): Promise<CampaignView[]> {
    const rows = await this.db.campaign.findMany({
      where: { healthStatus: { in: HEALTH_SEVERITY_ORDER } },
      orderBy: [{ updatedAt: "desc" }],
      include: { channels: true },
    });
    const ranked = rows
      .sort(
        (a, b) =>
          HEALTH_SEVERITY_ORDER.indexOf(a.healthStatus) -
            HEALTH_SEVERITY_ORDER.indexOf(b.healthStatus) ||
          b.updatedAt.getTime() - a.updatedAt.getTime(),
      )
      .slice(0, limit);
    return this.toViews(ranked);
  }

  async findById(id: string): Promise<CampaignView | null> {
    const row = await this.db.campaign.findUnique({
      where: { id },
      include: { channels: true },
    });
    if (!row) {
      return null;
    }
    const [view] = await this.toViews([row]);
    return view ?? null;
  }

  async getById(id: string): Promise<CampaignView> {
    const view = await this.findById(id);
    if (!view) {
      throw new NotFoundError("Campaign", id);
    }
    return view;
  }

  async getHealth(id: string): Promise<CampaignHealthView | null> {
    const view = await this.findById(id);
    if (!view) {
      return null;
    }
    return { campaignId: view.id, overall: view.healthStatus, channels: view.channels };
  }

  /**
   * Validates and creates a campaign with its channels. Validation runs here, not only in the
   * UI, because the API must never trust the client.
   */
  async create(input: unknown): Promise<CampaignView> {
    const parsed = createCampaignSchema.safeParse(input);
    if (!parsed.success) {
      throw ValidationError.fromZod(parsed.error, "Campaign details are invalid");
    }
    const { name, advertiserName, channels } = parsed.data;

    const row = await this.db.campaign.create({
      data: {
        name,
        advertiserName,
        status: "ACTIVE",
        healthStatus: "UNKNOWN",
        channels: { create: channels.map((channel) => ({ channel })) },
      },
      include: { channels: true },
    });

    this.logger.info({ campaignId: row.id, channels }, "campaign created");

    const [view] = await this.toViews([row]);
    if (!view) {
      throw new Error("Created campaign could not be loaded");
    }
    return view;
  }

  private async toViews(rows: CampaignRow[]): Promise<CampaignView[]> {
    if (rows.length === 0) {
      return [];
    }
    const ids = rows.map((row) => row.id);
    const [counts, incidentGroups, deadLetterGroups] = await Promise.all([
      this.metrics.countsByCampaignChannel(ids),
      this.db.incident.groupBy({
        by: ["campaignId"],
        where: { campaignId: { in: ids }, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
        _count: { _all: true },
      }),
      this.db.deadLetterEntry.groupBy({
        by: ["campaignId"],
        where: { campaignId: { in: ids }, status: "PENDING" },
        _count: { _all: true },
      }),
    ]);
    const openIncidents = new Map(
      incidentGroups.map((group) => [group.campaignId, group._count._all]),
    );
    const deadLetters = new Map(
      deadLetterGroups.map((group) => [group.campaignId, group._count._all]),
    );
    return rows.map((row) =>
      toView(row, counts.get(row.id) ?? new Map(), {
        openIncidentCount: openIncidents.get(row.id) ?? 0,
        deadLetterCount: deadLetters.get(row.id) ?? 0,
      }),
    );
  }
}

function toView(
  row: CampaignRow,
  countsByChannel: ChannelCounts,
  extras: { openIncidentCount: number; deadLetterCount: number },
): CampaignView {
  const channels: CampaignChannelView[] = [...row.channels]
    .sort((a, b) => (CHANNEL_ORDER.get(a.channel) ?? 99) - (CHANNEL_ORDER.get(b.channel) ?? 99))
    .map((channel) => ({
      id: channel.id,
      channel: channel.channel,
      healthStatus: channel.healthStatus,
      metrics: computeMetrics(
        countsByChannel.get(channel.channel) ?? { successes: 0, failures: 0 },
      ),
    }));

  return {
    id: row.id,
    name: row.name,
    advertiserName: row.advertiserName,
    status: row.status,
    healthStatus: row.healthStatus,
    channels,
    metrics: computeMetrics(mergeOutcomeCounts([...countsByChannel.values()])),
    openIncidentCount: extras.openIncidentCount,
    deadLetterCount: extras.deadLetterCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
