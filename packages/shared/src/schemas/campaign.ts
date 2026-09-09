import { ChannelSchema } from "@campaignpulse/event-contracts";
import { z } from "zod";

export const CAMPAIGN_NAME_MAX_LENGTH = 255;
export const ADVERTISER_NAME_MAX_LENGTH = 255;

/**
 * Validation for creating a campaign. Used by the web form for immediate feedback and by the
 * API before touching the database, so the server never relies on the client having validated.
 */
export const createCampaignSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Campaign name is required")
    .max(
      CAMPAIGN_NAME_MAX_LENGTH,
      `Campaign name must be ${CAMPAIGN_NAME_MAX_LENGTH} characters or fewer`,
    ),
  advertiserName: z
    .string()
    .trim()
    .min(1, "Advertiser name is required")
    .max(
      ADVERTISER_NAME_MAX_LENGTH,
      `Advertiser name must be ${ADVERTISER_NAME_MAX_LENGTH} characters or fewer`,
    ),
  channels: z
    .array(ChannelSchema)
    .min(1, "Select at least one channel")
    .refine((channels) => new Set(channels).size === channels.length, {
      message: "Each channel can only be selected once",
    }),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
