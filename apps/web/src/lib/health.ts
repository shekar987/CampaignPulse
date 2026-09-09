import type { CampaignStatus, EventStatus, HealthStatus } from "@campaignpulse/event-contracts";

import type { IconName } from "../components/ui/Icon";

export type Tone = "success" | "warning" | "error" | "neutral" | "info";

export const HEALTH_TONES: Record<HealthStatus, Tone> = {
  HEALTHY: "success",
  DEGRADED: "warning",
  CRITICAL: "error",
  UNKNOWN: "neutral",
};

export const HEALTH_ICONS: Record<HealthStatus, IconName> = {
  HEALTHY: "check-circle",
  DEGRADED: "alert-triangle",
  CRITICAL: "alert-octagon",
  UNKNOWN: "minus-circle",
};

export const CAMPAIGN_STATUS_TONES: Record<CampaignStatus, Tone> = {
  DRAFT: "neutral",
  ACTIVE: "info",
  PAUSED: "warning",
  COMPLETED: "neutral",
};

export const EVENT_STATUS_TONES: Record<EventStatus, Tone> = {
  PENDING: "neutral",
  PROCESSING: "info",
  SUCCESS: "success",
  FAILED: "error",
  RETRYING: "warning",
  FINAL_FAILURE: "error",
};

export const INCIDENT_STATUS_TONES = {
  OPEN: "error",
  ACKNOWLEDGED: "warning",
  RESOLVED: "success",
} as const satisfies Record<string, Tone>;

export const INCIDENT_SEVERITY_TONES = {
  WARNING: "warning",
  CRITICAL: "error",
} as const satisfies Record<string, Tone>;

export const DEAD_LETTER_STATUS_TONES = {
  PENDING: "error",
  REPLAYED: "info",
  DISCARDED: "neutral",
} as const satisfies Record<string, Tone>;

/** Tone for a success or error rate, mirroring the health thresholds. */
export function rateTone(errorRate: number | null | undefined): Tone {
  if (errorRate === null || errorRate === undefined) {
    return "neutral";
  }
  if (errorRate >= 0.1) {
    return "error";
  }
  if (errorRate >= 0.02) {
    return "warning";
  }
  return "success";
}
