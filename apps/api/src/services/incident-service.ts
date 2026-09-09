import type { Channel, HealthStatus } from "@campaignpulse/event-contracts";
import {
  CHANNEL_LABELS,
  HEALTH_THRESHOLDS,
  MIN_OUTCOMES_FOR_INCIDENT,
  computeMetrics,
  evaluateIncidentSeverity,
  type DeliveryMetrics,
} from "@campaignpulse/shared";

import type { PrismaClient } from "../db/client";
import { createEvent, toEventRow } from "../events/event-mapper";
import { Prisma } from "../generated/prisma/client";
import type { Logger } from "../logging/logger";
import type { NotificationPublisher } from "../notifications/notification-publisher";
import { NotFoundError, ValidationError } from "./errors";
import type { MetricsService } from "./metrics-service";
import { buildPage, toSkipTake, type Page, type PageParams } from "./pagination";

export type IncidentStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
export type IncidentSeverity = "WARNING" | "CRITICAL";

export interface IncidentView {
  id: string;
  campaignId: string;
  campaignName: string;
  advertiserName: string;
  channel: Channel;
  status: IncidentStatus;
  severity: IncidentSeverity;
  title: string;
  description: string | null;
  errorRateAtDetection: number | null;
  failedEventsAtDetection: number | null;
  totalEventsAtDetection: number | null;
  resolutionNote: string | null;
  startedAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  updatedAt: Date;
  currentChannelHealth: HealthStatus;
  currentMetrics: DeliveryMetrics;
}

export interface IncidentListParams extends PageParams {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  campaignId?: string;
  channel?: Channel;
}

export type IncidentEvaluation =
  | { action: "none" }
  | { action: "unchanged"; incident: IncidentView }
  | { action: "created"; incident: IncidentView }
  | { action: "escalated"; incident: IncidentView };

type IncidentRow = Prisma.IncidentGetPayload<{
  include: { campaign: { select: { name: true; advertiserName: true } } };
}>;

const INCLUDE_CAMPAIGN = { campaign: { select: { name: true, advertiserName: true } } } as const;
const ACTIVE_STATUSES: IncidentStatus[] = ["OPEN", "ACKNOWLEDGED"];

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Opens, escalates, acknowledges and resolves incidents. Detection is driven by channel health
 * after every processed delivery; at most one unresolved incident exists per campaign channel,
 * enforced by a partial unique index so concurrent workers cannot open duplicates.
 */
export class IncidentService {
  constructor(
    private readonly db: PrismaClient,
    private readonly metrics: MetricsService,
    private readonly notifications: NotificationPublisher,
    private readonly logger: Logger,
    private readonly clock: () => Date = () => new Date(),
    private readonly minimumOutcomes: number = MIN_OUTCOMES_FOR_INCIDENT,
  ) {}

  async list(params: IncidentListParams): Promise<Page<IncidentView>> {
    const where: Prisma.IncidentWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.severity ? { severity: params.severity } : {}),
      ...(params.campaignId ? { campaignId: params.campaignId } : {}),
      ...(params.channel ? { channel: params.channel } : {}),
    };
    const [totalCount, rows] = await this.db.$transaction([
      this.db.incident.count({ where }),
      this.db.incident.findMany({
        where,
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
        ...toSkipTake(params),
        include: INCLUDE_CAMPAIGN,
      }),
    ]);
    return buildPage(await this.toViews(rows), totalCount, params);
  }

  async findById(id: string): Promise<IncidentView | null> {
    const row = await this.db.incident.findUnique({ where: { id }, include: INCLUDE_CAMPAIGN });
    if (!row) {
      return null;
    }
    const [view] = await this.toViews([row]);
    return view ?? null;
  }

  async countActive(campaignId?: string): Promise<number> {
    return this.db.incident.count({
      where: { status: { in: ACTIVE_STATUSES }, ...(campaignId ? { campaignId } : {}) },
    });
  }

  async acknowledge(id: string): Promise<IncidentView> {
    const now = this.clock();
    const updated = await this.db.incident.updateMany({
      where: { id, status: "OPEN" },
      data: { status: "ACKNOWLEDGED", acknowledgedAt: now },
    });
    if (updated.count === 0) {
      const existing = await this.db.incident.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundError("Incident", id);
      }
      throw new ValidationError("Only open incidents can be acknowledged", [
        { path: "id", message: `Incident is ${existing.status.toLowerCase()}` },
      ]);
    }
    const incident = await this.requireView(id);
    await this.recordIncidentEvent(incident, "INCIDENT_ACKNOWLEDGED", "PROCESSING", now);
    this.logger.info({ incidentId: id, campaignId: incident.campaignId }, "incident acknowledged");
    return incident;
  }

  async resolve(id: string, note?: string | null): Promise<IncidentView> {
    const now = this.clock();
    const trimmed = note?.trim() || null;
    const updated = await this.db.incident.updateMany({
      where: { id, status: { in: ACTIVE_STATUSES } },
      data: { status: "RESOLVED", resolvedAt: now, resolutionNote: trimmed },
    });
    if (updated.count === 0) {
      const existing = await this.db.incident.findUnique({ where: { id } });
      if (!existing) {
        throw new NotFoundError("Incident", id);
      }
      throw new ValidationError("Incident is already resolved", [
        { path: "id", message: "Cannot resolve an incident that is already resolved" },
      ]);
    }
    const incident = await this.requireView(id);
    await this.recordIncidentEvent(incident, "INCIDENT_RESOLVED", "SUCCESS", now, {
      resolutionNote: trimmed,
    });
    this.logger.info({ incidentId: id, campaignId: incident.campaignId }, "incident resolved");
    return incident;
  }

  /**
   * Compares a channel's (already recalculated) health with its incident state and opens or
   * escalates an incident when a threshold is crossed on a meaningful sample. Recovery is not
   * automatic: an engineer resolves the incident once they are satisfied the channel is stable.
   */
  async evaluateChannel(campaignId: string, channel: Channel): Promise<IncidentEvaluation> {
    const channelRow = await this.db.campaignChannel.findUnique({
      where: { campaignId_channel: { campaignId, channel } },
    });
    if (!channelRow) {
      return { action: "none" };
    }
    const counts = (await this.metrics.countsByCampaignChannel([campaignId]))
      .get(campaignId)
      ?.get(channel);
    const metrics = computeMetrics(counts ?? { successes: 0, failures: 0 });
    const severity = evaluateIncidentSeverity(
      channelRow.healthStatus,
      metrics.totalEvents,
      this.minimumOutcomes,
    );
    const active = await this.db.incident.findFirst({
      where: { campaignId, channel, status: { in: ACTIVE_STATUSES } },
      include: INCLUDE_CAMPAIGN,
    });

    if (!severity) {
      return active
        ? { action: "unchanged", incident: await this.requireView(active.id) }
        : { action: "none" };
    }

    if (!active) {
      return this.openIncident(campaignId, channel, severity, metrics);
    }

    if (active.severity === "WARNING" && severity === "CRITICAL") {
      await this.db.incident.update({ where: { id: active.id }, data: { severity: "CRITICAL" } });
      const incident = await this.requireView(active.id);
      await this.notifications.publish({
        type: "INCIDENT_ESCALATED",
        subject: `Incident escalated to critical: ${incident.title}`,
        message: `${incident.campaignName} (${CHANNEL_LABELS[channel]}) has escalated from degraded to critical.`,
        attributes: {
          incidentId: incident.id,
          campaignId,
          channel,
          severity: "CRITICAL",
        },
      });
      this.logger.warn(
        { incidentId: active.id, campaignId, channel },
        "incident escalated to critical",
      );
      return { action: "escalated", incident };
    }

    return { action: "unchanged", incident: await this.requireView(active.id) };
  }

  private async openIncident(
    campaignId: string,
    channel: Channel,
    severity: IncidentSeverity,
    metrics: DeliveryMetrics,
  ): Promise<IncidentEvaluation> {
    const now = this.clock();
    const errorRate = metrics.errorRate ?? 0;
    const threshold =
      severity === "CRITICAL" ? HEALTH_THRESHOLDS.critical : HEALTH_THRESHOLDS.degraded;
    const title = `${CHANNEL_LABELS[channel]} delivery failures`;
    const description =
      `Error rate ${(errorRate * 100).toFixed(1)}% (${metrics.failedEvents} of ${metrics.totalEvents} ` +
      `delivery attempts failed) is above the ${(threshold * 100).toFixed(0)}% ` +
      `${severity === "CRITICAL" ? "critical" : "degraded"} threshold.`;

    let row: IncidentRow;
    try {
      row = await this.db.incident.create({
        data: {
          campaignId,
          channel,
          severity,
          title,
          description,
          errorRateAtDetection: errorRate,
          failedEventsAtDetection: metrics.failedEvents,
          totalEventsAtDetection: metrics.totalEvents,
          startedAt: now,
        },
        include: INCLUDE_CAMPAIGN,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      // Another worker opened the incident first; report it rather than fail.
      const existing = await this.db.incident.findFirst({
        where: { campaignId, channel, status: { in: ACTIVE_STATUSES } },
      });
      if (!existing) {
        throw error;
      }
      return { action: "unchanged", incident: await this.requireView(existing.id) };
    }

    const incident = await this.requireView(row.id);
    await this.recordIncidentEvent(incident, "INCIDENT_CREATED", "FAILED", now, {
      severity,
      errorRate,
    });
    await this.notifications.publish({
      type: "INCIDENT_CREATED",
      subject: `${severity === "CRITICAL" ? "Critical" : "Warning"} incident: ${title}`,
      message: `${incident.campaignName} (${incident.advertiserName}): ${description}`,
      attributes: { incidentId: incident.id, campaignId, channel, severity },
    });
    this.logger.warn(
      { incidentId: incident.id, campaignId, channel, severity, errorRate },
      "incident created",
    );
    return { action: "created", incident };
  }

  private async recordIncidentEvent(
    incident: IncidentView,
    eventType: "INCIDENT_CREATED" | "INCIDENT_ACKNOWLEDGED" | "INCIDENT_RESOLVED",
    status: "FAILED" | "PROCESSING" | "SUCCESS",
    occurredAt: Date,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const event = createEvent({
      campaignId: incident.campaignId,
      correlationId: `incident-${incident.id}`,
      eventType,
      channel: incident.channel,
      status,
      attempt: 1,
      occurredAt,
      metadata: { incidentId: incident.id, title: incident.title, ...metadata },
    });
    await this.db.deliveryEvent.create({ data: toEventRow(event) });
  }

  private async requireView(id: string): Promise<IncidentView> {
    const view = await this.findById(id);
    if (!view) {
      throw new NotFoundError("Incident", id);
    }
    return view;
  }

  private async toViews(rows: IncidentRow[]): Promise<IncidentView[]> {
    if (rows.length === 0) {
      return [];
    }
    const campaignIds = [...new Set(rows.map((row) => row.campaignId))];
    const [counts, channelRows] = await Promise.all([
      this.metrics.countsByCampaignChannel(campaignIds),
      this.db.campaignChannel.findMany({ where: { campaignId: { in: campaignIds } } }),
    ]);
    const healthByKey = new Map(
      channelRows.map((row) => [`${row.campaignId}:${row.channel}`, row.healthStatus] as const),
    );

    return rows.map((row) => ({
      id: row.id,
      campaignId: row.campaignId,
      campaignName: row.campaign.name,
      advertiserName: row.campaign.advertiserName,
      channel: row.channel,
      status: row.status,
      severity: row.severity,
      title: row.title,
      description: row.description,
      errorRateAtDetection: row.errorRateAtDetection,
      failedEventsAtDetection: row.failedEventsAtDetection,
      totalEventsAtDetection: row.totalEventsAtDetection,
      resolutionNote: row.resolutionNote,
      startedAt: row.startedAt,
      acknowledgedAt: row.acknowledgedAt,
      resolvedAt: row.resolvedAt,
      updatedAt: row.updatedAt,
      currentChannelHealth: healthByKey.get(`${row.campaignId}:${row.channel}`) ?? "UNKNOWN",
      currentMetrics: computeMetrics(
        counts.get(row.campaignId)?.get(row.channel) ?? { successes: 0, failures: 0 },
      ),
    }));
  }
}
