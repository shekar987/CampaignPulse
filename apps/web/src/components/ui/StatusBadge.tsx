import type { CampaignStatus, EventStatus, HealthStatus } from "@campaignpulse/event-contracts";
import { CAMPAIGN_STATUS_LABELS, EVENT_STATUS_LABELS, HEALTH_LABELS } from "@campaignpulse/shared";
import type { ReactNode } from "react";

import {
  CAMPAIGN_STATUS_TONES,
  EVENT_STATUS_TONES,
  HEALTH_ICONS,
  HEALTH_TONES,
  type Tone,
} from "../../lib/health";
import { Icon } from "./Icon";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-status-success-bg text-status-success-fg border-status-success-border",
  warning: "bg-status-warning-bg text-status-warning-fg border-status-warning-border",
  error: "bg-status-error-bg text-status-error-fg border-status-error-border",
  neutral: "bg-status-neutral-bg text-status-neutral-fg border-status-neutral-border",
  info: "bg-status-info-bg text-status-info-fg border-status-info-border",
};

const SIZE_CLASSES = {
  sm: "px-1.5 py-0.5 text-xs gap-1",
  md: "px-2.5 py-1 text-sm gap-1.5",
} as const;

export interface StatusBadgeProps {
  tone: Tone;
  /** Always shown: colour is never the only status indicator. */
  label: string;
  icon?: ReactNode;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function StatusBadge({ tone, label, icon, size = "md", className = "" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium whitespace-nowrap ${TONE_CLASSES[tone]} ${SIZE_CLASSES[size]} ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}

export function HealthBadge({
  status,
  size = "md",
  className,
}: {
  status: HealthStatus;
  size?: StatusBadgeProps["size"];
  className?: string;
}) {
  return (
    <StatusBadge
      tone={HEALTH_TONES[status]}
      label={HEALTH_LABELS[status]}
      icon={<Icon name={HEALTH_ICONS[status]} size={size === "sm" ? 12 : 14} />}
      size={size}
      className={className}
    />
  );
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <StatusBadge
      tone={CAMPAIGN_STATUS_TONES[status]}
      label={CAMPAIGN_STATUS_LABELS[status]}
      size="sm"
    />
  );
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return (
    <StatusBadge tone={EVENT_STATUS_TONES[status]} label={EVENT_STATUS_LABELS[status]} size="sm" />
  );
}
