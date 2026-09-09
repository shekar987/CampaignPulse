import { ChannelSchema, HealthStatusSchema } from "@campaignpulse/event-contracts";
import { z } from "zod";

import type { CampaignListParams } from "../services/campaign-service";
import type { DeliveryEventListParams } from "../services/delivery-event-service";
import { ValidationError } from "../services/errors";
import { MAX_PAGE_SIZE } from "../services/pagination";

export const DEFAULT_CAMPAIGN_PAGE_SIZE = 9;
export const DEFAULT_EVENT_PAGE_SIZE = 25;

const pageSchema = z.number().int().min(1, "page must be 1 or greater");
const pageSizeSchema = z
  .number()
  .int()
  .min(1, "pageSize must be 1 or greater")
  .max(MAX_PAGE_SIZE, `pageSize must be ${MAX_PAGE_SIZE} or fewer`);

const campaignListArgsSchema = z.object({
  filter: z
    .object({
      search: z.string().trim().max(200, "search must be 200 characters or fewer").nullish(),
      healthStatus: HealthStatusSchema.nullish(),
      channel: ChannelSchema.nullish(),
    })
    .nullish(),
  sort: z.enum(["NEWEST", "OLDEST", "NAME"]).nullish(),
  page: pageSchema.nullish(),
  pageSize: pageSizeSchema.nullish(),
});

const deliveryEventListArgsSchema = z.object({
  campaignId: z.string().min(1),
  channel: ChannelSchema.nullish(),
  correlationId: z.string().trim().max(255).nullish(),
  page: pageSchema.nullish(),
  pageSize: pageSizeSchema.nullish(),
});

function parse<T extends z.ZodType>(schema: T, args: unknown): z.infer<T> {
  const result = schema.safeParse(args);
  if (!result.success) {
    throw ValidationError.fromZod(result.error, "Query arguments are invalid");
  }
  return result.data;
}

/** Validates `campaigns` query arguments and fills in defaults. */
export function parseCampaignListArgs(args: unknown): CampaignListParams {
  const parsed = parse(campaignListArgsSchema, args);
  return {
    search: parsed.filter?.search || undefined,
    healthStatus: parsed.filter?.healthStatus ?? undefined,
    channel: parsed.filter?.channel ?? undefined,
    sort: parsed.sort ?? "NEWEST",
    page: parsed.page ?? 1,
    pageSize: parsed.pageSize ?? DEFAULT_CAMPAIGN_PAGE_SIZE,
  };
}

/** Validates `deliveryEvents` query arguments and fills in defaults. */
export function parseDeliveryEventListArgs(args: unknown): DeliveryEventListParams {
  const parsed = parse(deliveryEventListArgsSchema, args);
  return {
    campaignId: parsed.campaignId,
    channel: parsed.channel ?? undefined,
    correlationId: parsed.correlationId || undefined,
    page: parsed.page ?? 1,
    pageSize: parsed.pageSize ?? DEFAULT_EVENT_PAGE_SIZE,
  };
}

const uuidSchema = z.uuid();

/**
 * Ids are UUIDs in the database. A malformed id can never match a row, so callers treat it as
 * "not found" instead of letting PostgreSQL reject the cast.
 */
export function isUuid(value: string): boolean {
  return uuidSchema.safeParse(value).success;
}
