import type { Channel, ErrorCode, EventStatus, EventType } from "@campaignpulse/event-contracts";

import type { PrismaClient } from "../db/client";
import type { Prisma } from "../generated/prisma/client";
import { buildPage, toSkipTake, type Page, type PageParams } from "./pagination";

export interface DeliveryEventView {
  id: string;
  campaignId: string;
  correlationId: string;
  eventType: EventType;
  channel: Channel;
  status: EventStatus;
  attempt: number;
  occurredAt: Date;
  latencyMs: number | null;
  metadata: unknown;
  error: { code: ErrorCode; message: string } | null;
}

export interface DeliveryEventListParams extends PageParams {
  campaignId: string;
  channel?: Channel;
  correlationId?: string;
}

export class DeliveryEventService {
  constructor(private readonly db: PrismaClient) {}

  /** Newest events first. A correlation id filter shows one delivery workflow end to end. */
  async list(params: DeliveryEventListParams): Promise<Page<DeliveryEventView>> {
    const where: Prisma.DeliveryEventWhereInput = {
      campaignId: params.campaignId,
      ...(params.channel ? { channel: params.channel } : {}),
      ...(params.correlationId ? { correlationId: params.correlationId } : {}),
    };

    const [totalCount, rows] = await this.db.$transaction([
      this.db.deliveryEvent.count({ where }),
      this.db.deliveryEvent.findMany({
        where,
        orderBy: [{ occurredAt: "desc" }, { attempt: "desc" }, { id: "desc" }],
        ...toSkipTake(params),
      }),
    ]);

    return buildPage(rows.map(toView), totalCount, params);
  }
}

function toView(row: Prisma.DeliveryEventGetPayload<Record<string, never>>): DeliveryEventView {
  return {
    id: row.id,
    campaignId: row.campaignId,
    correlationId: row.correlationId,
    eventType: row.eventType,
    channel: row.channel,
    status: row.status,
    attempt: row.attempt,
    occurredAt: row.occurredAt,
    latencyMs: row.latencyMs,
    metadata: row.metadata ?? null,
    error:
      row.errorCode && row.errorMessage ? { code: row.errorCode, message: row.errorMessage } : null,
  };
}
