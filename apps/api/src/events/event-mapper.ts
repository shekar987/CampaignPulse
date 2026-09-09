import { randomUUID } from "node:crypto";

import type {
  Channel,
  DeliveryEvent,
  EventStatus,
  EventType,
} from "@campaignpulse/event-contracts";

import type { Prisma } from "../generated/prisma/client";

export interface EventDraft {
  campaignId: string;
  correlationId: string;
  eventType: EventType;
  channel: Channel;
  status: EventStatus;
  attempt: number;
  occurredAt: Date;
  metadata?: Record<string, unknown>;
  error?: {
    code: DeliveryEvent["error"] extends infer E
      ? E extends { code: infer C }
        ? C
        : never
      : never;
    message: string;
  };
}

/** Builds a fully-formed event with a fresh id, the idempotency key for consumers. */
export function createEvent(draft: EventDraft): DeliveryEvent {
  return {
    id: randomUUID(),
    campaignId: draft.campaignId,
    correlationId: draft.correlationId,
    eventType: draft.eventType,
    channel: draft.channel,
    status: draft.status,
    attempt: draft.attempt,
    occurredAt: draft.occurredAt.toISOString(),
    ...(draft.metadata ? { metadata: draft.metadata } : {}),
    ...(draft.error ? { error: draft.error } : {}),
  };
}

function latencyFromMetadata(metadata: Record<string, unknown> | undefined): number | null {
  const value = metadata?.latencyMs;
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

/** Maps a contract event onto the `delivery_events` row shape. */
export function toEventRow(event: DeliveryEvent): Prisma.DeliveryEventCreateManyInput {
  return {
    id: event.id,
    campaignId: event.campaignId,
    correlationId: event.correlationId,
    eventType: event.eventType,
    channel: event.channel,
    status: event.status,
    attempt: event.attempt,
    occurredAt: new Date(event.occurredAt),
    latencyMs: latencyFromMetadata(event.metadata),
    errorCode: event.error?.code ?? null,
    errorMessage: event.error?.message ?? null,
    metadata: (event.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
  };
}
