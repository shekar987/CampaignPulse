import type {
  CampaignStatus,
  Channel,
  ErrorCode,
  EventStatus,
  EventType,
  HealthStatus,
} from "@campaignpulse/event-contracts";

export const CHANNEL_LABELS: Record<Channel, string> = {
  WEB: "Website",
  MOBILE_APP: "Mobile app",
  IN_STORE_DISPLAY: "In-store display",
  SMARTSHOP: "SmartShop",
};

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  HEALTHY: "Healthy",
  DEGRADED: "Degraded",
  CRITICAL: "Critical",
  UNKNOWN: "No data",
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  PAUSED: "Paused",
  COMPLETED: "Completed",
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  CAMPAIGN_DELIVERY_REQUESTED: "Delivery requested",
  DELIVERY_STARTED: "Delivery started",
  DELIVERY_SUCCEEDED: "Delivery succeeded",
  DELIVERY_FAILED: "Delivery failed",
  DELIVERY_RETRY_REQUESTED: "Retry requested",
  DELIVERY_RETRY_SUCCEEDED: "Retry succeeded",
  DELIVERY_FINAL_FAILURE: "Final failure (dead-letter queue)",
  INCIDENT_CREATED: "Incident created",
  INCIDENT_ACKNOWLEDGED: "Incident acknowledged",
  INCIDENT_RESOLVED: "Incident resolved",
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SUCCESS: "Success",
  FAILED: "Failed",
  RETRYING: "Retrying",
  FINAL_FAILURE: "Final failure",
};

export const ERROR_CODE_LABELS: Record<ErrorCode, string> = {
  TIMEOUT: "Timeout",
  RATE_LIMITED: "Rate limited",
  VALIDATION_ERROR: "Validation error",
  DEPENDENCY_UNAVAILABLE: "Dependency unavailable",
  AUTHORIZATION_ERROR: "Authorization error",
  NETWORK_ERROR: "Network error",
  UNKNOWN_ERROR: "Unknown error",
};

export const INCIDENT_STATUS_LABELS = {
  OPEN: "Investigating",
  ACKNOWLEDGED: "Acknowledged",
  RESOLVED: "Resolved",
} as const;

export const INCIDENT_SEVERITY_LABELS = {
  WARNING: "Warning",
  CRITICAL: "Critical",
} as const;

export const DEAD_LETTER_STATUS_LABELS = {
  PENDING: "Awaiting replay",
  REPLAYED: "Replayed",
  DISCARDED: "Discarded",
} as const;

export const DEAD_LETTER_REASON_LABELS = {
  RETRIES_EXHAUSTED: "Retries exhausted",
  NON_RETRYABLE_ERROR: "Non-retryable error",
  PROCESSING_FAILURE: "Message could not be processed",
} as const;
