import { z } from "zod";

import { ChannelSchema, ErrorCodeSchema, EventStatusSchema, EventTypeSchema } from "./enums";

export const DeliveryErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string().min(1).max(2000),
});
export type DeliveryError = z.infer<typeof DeliveryErrorSchema>;

/**
 * The single event shape shared by the API, the event bus and the UI.
 *
 * `correlationId` ties together every event produced by one delivery workflow
 * (requested -> started -> failed -> retry -> succeeded), so an engineer can trace a
 * delivery end to end. `id` is the idempotency key: an event with an id that has already
 * been processed must be ignored safely.
 */
export const DeliveryEventSchema = z.object({
  id: z.uuid(),
  campaignId: z.uuid(),
  correlationId: z.string().min(1).max(255),
  eventType: EventTypeSchema,
  channel: ChannelSchema,
  status: EventStatusSchema,
  attempt: z.number().int().min(1),
  occurredAt: z.iso.datetime({ offset: true }),
  metadata: z.record(z.string(), z.unknown()).optional(),
  error: DeliveryErrorSchema.optional(),
});
export type DeliveryEvent = z.infer<typeof DeliveryEventSchema>;
