import { z } from "zod";

/**
 * Simulated delivery channels. These are portfolio abstractions of the kinds of surfaces a
 * retail media campaign might be delivered to; they do not represent any real operator's systems.
 */
export const CHANNELS = ["WEB", "MOBILE_APP", "IN_STORE_DISPLAY", "SMARTSHOP"] as const;
export const ChannelSchema = z.enum(CHANNELS);
export type Channel = z.infer<typeof ChannelSchema>;

/** Every event type that can appear on a campaign's delivery timeline. */
export const EVENT_TYPES = [
  "CAMPAIGN_DELIVERY_REQUESTED",
  "DELIVERY_STARTED",
  "DELIVERY_SUCCEEDED",
  "DELIVERY_FAILED",
  "DELIVERY_RETRY_REQUESTED",
  "DELIVERY_RETRY_SUCCEEDED",
  "DELIVERY_FINAL_FAILURE",
  "INCIDENT_CREATED",
  "INCIDENT_ACKNOWLEDGED",
  "INCIDENT_RESOLVED",
] as const;
export const EventTypeSchema = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof EventTypeSchema>;

/** Processing status of a delivery at the time an event was recorded. */
export const EVENT_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "RETRYING",
  "FINAL_FAILURE",
] as const;
export const EventStatusSchema = z.enum(EVENT_STATUSES);
export type EventStatus = z.infer<typeof EventStatusSchema>;

/** Failure classifications attached to failed delivery events. */
export const ERROR_CODES = [
  "TIMEOUT",
  "RATE_LIMITED",
  "VALIDATION_ERROR",
  "DEPENDENCY_UNAVAILABLE",
  "AUTHORIZATION_ERROR",
  "NETWORK_ERROR",
  "UNKNOWN_ERROR",
] as const;
export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/** Health of a campaign, channel or the whole system, derived from delivery error rates. */
export const HEALTH_STATUSES = ["HEALTHY", "DEGRADED", "CRITICAL", "UNKNOWN"] as const;
export const HealthStatusSchema = z.enum(HEALTH_STATUSES);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

/** Lifecycle status of a campaign (distinct from its delivery health). */
export const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED"] as const;
export const CampaignStatusSchema = z.enum(CAMPAIGN_STATUSES);
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;
