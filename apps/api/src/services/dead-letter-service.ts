import {
  readSimulationParams,
  type Channel,
  type DeliveryEvent,
  type ErrorCode,
  type SimulationParams,
} from "@campaignpulse/event-contracts";
import type { DeadLetterReason } from "@campaignpulse/shared";

import type { PrismaClient } from "../db/client";
import type { EventBus } from "../events/event-bus";
import { createEvent, toEventRow } from "../events/event-mapper";
import type { Prisma } from "../generated/prisma/client";
import type { Logger } from "../logging/logger";
import type { NotificationPublisher } from "../notifications/notification-publisher";
import { buildPage, toSkipTake, type Page, type PageParams } from "./pagination";

export type DeadLetterStatus = "PENDING" | "REPLAYED" | "DISCARDED";

export interface DeadLetterView {
  id: string;
  campaignId: string;
  campaignName: string;
  correlationId: string;
  channel: Channel;
  attempts: number;
  lastError: { code: ErrorCode; message: string };
  reason: DeadLetterReason;
  status: DeadLetterStatus;
  enqueuedAt: Date;
  replayedAt: Date | null;
  replayCorrelationId: string | null;
}

export interface DeadLetterListParams extends PageParams {
  campaignId?: string;
  status?: DeadLetterStatus;
}

export interface ReplayResult {
  replayed: number;
  correlationIds: string[];
}

type DeadLetterRow = Prisma.DeadLetterEntryGetPayload<{
  include: { campaign: { select: { name: true } } };
}>;

const INCLUDE_CAMPAIGN = { campaign: { select: { name: true } } } as const;

function toView(row: DeadLetterRow): DeadLetterView {
  return {
    id: row.id,
    campaignId: row.campaignId,
    campaignName: row.campaign.name,
    correlationId: row.correlationId,
    channel: row.channel,
    attempts: row.attempts,
    lastError: { code: row.lastErrorCode, message: row.lastErrorMessage },
    reason: row.reason,
    status: row.status,
    enqueuedAt: row.enqueuedAt,
    replayedAt: row.replayedAt,
    replayCorrelationId: row.replayCorrelationId,
  };
}

/**
 * The dead-letter queue as engineers see it: deliveries that gave up, why, and the ability to
 * replay them once the underlying problem is fixed. Entries are written by the delivery
 * processor (retries exhausted or non-retryable error) and by the poison-message path of the
 * transport (a message the worker could not process at all).
 */
export class DeadLetterService {
  constructor(
    private readonly db: PrismaClient,
    private readonly bus: EventBus,
    private readonly notifications: NotificationPublisher,
    private readonly logger: Logger,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async list(params: DeadLetterListParams): Promise<Page<DeadLetterView>> {
    const where: Prisma.DeadLetterEntryWhereInput = {
      ...(params.campaignId ? { campaignId: params.campaignId } : {}),
      ...(params.status ? { status: params.status } : {}),
    };
    const [totalCount, rows] = await this.db.$transaction([
      this.db.deadLetterEntry.count({ where }),
      this.db.deadLetterEntry.findMany({
        where,
        orderBy: [{ enqueuedAt: "desc" }, { id: "desc" }],
        ...toSkipTake(params),
        include: INCLUDE_CAMPAIGN,
      }),
    ]);
    return buildPage(rows.map(toView), totalCount, params);
  }

  async countPending(campaignId?: string): Promise<number> {
    return this.db.deadLetterEntry.count({
      where: { status: "PENDING", ...(campaignId ? { campaignId } : {}) },
    });
  }

  /** Records a message the transport gave up on after repeated processing failures. */
  async recordPoisonMessage(event: DeliveryEvent, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    const lastErrorMessage = `Message could not be processed: ${message}`.slice(0, 2000);
    const now = this.clock();
    const payload = event as unknown as Prisma.InputJsonValue;
    // The message may be malformed (that can be why it failed), so never trust its attempt count.
    const attempts = Number.isInteger(event.attempt) && event.attempt >= 1 ? event.attempt : 1;
    await this.db.deadLetterEntry.upsert({
      where: { correlationId: event.correlationId },
      create: {
        campaignId: event.campaignId,
        correlationId: event.correlationId,
        channel: event.channel,
        attempts,
        lastErrorCode: "UNKNOWN_ERROR",
        lastErrorMessage,
        reason: "PROCESSING_FAILURE",
        payload,
        enqueuedAt: now,
      },
      update: {
        attempts,
        lastErrorCode: "UNKNOWN_ERROR",
        lastErrorMessage,
        reason: "PROCESSING_FAILURE",
        payload,
        status: "PENDING",
        enqueuedAt: now,
      },
    });
    this.logger.error(
      { eventId: event.id, correlationId: event.correlationId, campaignId: event.campaignId },
      "poison message recorded in dead-letter queue",
    );
    await this.notifications.publish({
      type: "DELIVERY_DEAD_LETTERED",
      subject: "Delivery message could not be processed",
      message: `Event ${event.id} for delivery ${event.correlationId} was dead-lettered: ${message}`,
      attributes: {
        campaignId: event.campaignId,
        channel: event.channel,
        correlationId: event.correlationId,
        reason: "PROCESSING_FAILURE",
      },
    });
  }

  /**
   * Re-requests every pending dead-lettered delivery for a campaign (optionally one channel).
   * Each replay is a new delivery workflow with its own correlation id, linked back to the
   * original, so the terminal state of the failed delivery is never rewritten. Scripted
   * failures are dropped from the replay: they model a transient outage that has passed.
   */
  async replay(campaignId: string, channel?: Channel): Promise<ReplayResult> {
    const entries = await this.db.deadLetterEntry.findMany({
      where: { campaignId, status: "PENDING", ...(channel ? { channel } : {}) },
      orderBy: { enqueuedAt: "asc" },
    });
    if (entries.length === 0) {
      return { replayed: 0, correlationIds: [] };
    }

    const now = this.clock();
    const events: DeliveryEvent[] = [];

    await this.db.$transaction(async (tx) => {
      for (const entry of entries) {
        const original = await tx.delivery.findUnique({
          where: { correlationId: entry.correlationId },
        });
        const payloadMetadata = (entry.payload as { metadata?: unknown } | null)?.metadata;
        const originalParams =
          readSimulationParams({ simulation: original?.simulation }) ??
          readSimulationParams(payloadMetadata);
        const base = entry.correlationId.replace(/-r\d+$/, "");
        const previousReplays = await tx.delivery.count({
          where: { correlationId: { startsWith: `${base}-r` } },
        });
        const replayCorrelationId = `${base}-r${previousReplays + 1}`;
        const simulation: SimulationParams = {
          runId: originalParams?.runId ?? "replay",
          scenario: originalParams?.scenario ?? "CUSTOM",
          failureRate: originalParams?.failureRate ?? 0,
          replayOf: entry.correlationId,
        };

        const event = createEvent({
          campaignId,
          correlationId: replayCorrelationId,
          eventType: "CAMPAIGN_DELIVERY_REQUESTED",
          channel: entry.channel,
          status: "PENDING",
          attempt: 1,
          occurredAt: now,
          metadata: { simulation, replayOf: entry.correlationId, deadLetterEntryId: entry.id },
        });

        await tx.delivery.create({
          data: {
            correlationId: replayCorrelationId,
            campaignId,
            channel: entry.channel,
            status: "PENDING",
            attempts: 0,
            simulation: simulation as unknown as Prisma.InputJsonValue,
            requestedAt: now,
          },
        });
        await tx.deliveryEvent.create({ data: toEventRow(event) });
        await tx.deadLetterEntry.update({
          where: { id: entry.id },
          data: { status: "REPLAYED", replayedAt: now, replayCorrelationId },
        });
        events.push(event);
      }
    });

    await this.bus.publishBatch(events);
    this.logger.info(
      { campaignId, channel, replayed: events.length },
      "dead-lettered deliveries replayed",
    );
    return { replayed: events.length, correlationIds: events.map((event) => event.correlationId) };
  }
}
