import type { ReactNode } from "react";

import type { Tone } from "../../lib/health";
import { Icon, type IconName } from "./Icon";
import { RateBar } from "./RateBar";

export const NO_DATA_MESSAGE = "No delivery data available";

const VALUE_TONE_CLASSES: Record<Tone, string> = {
  success: "text-status-success-fg",
  warning: "text-status-warning-fg",
  error: "text-status-error-fg",
  neutral: "text-fg-primary",
  info: "text-fg-primary",
};

const ACCENT_CLASSES: Record<Tone, string> = {
  success: "border-t-status-success-solid",
  warning: "border-t-status-warning-solid",
  error: "border-t-status-error-solid",
  neutral: "border-t-line",
  info: "border-t-status-info-solid",
};

const ICON_CLASSES: Record<Tone, string> = {
  success: "bg-status-success-bg text-status-success-fg",
  warning: "bg-status-warning-bg text-status-warning-fg",
  error: "bg-status-error-bg text-status-error-fg",
  neutral: "bg-surface-sunken text-fg-secondary",
  info: "bg-status-info-bg text-status-info-fg",
};

export interface MetricCardProps {
  label: string;
  /** Pre-formatted value. `null` renders the explicit no-data state instead of a misleading 0. */
  value: string | null;
  hint?: ReactNode;
  tone?: Tone;
  icon?: IconName;
  /** Optional fraction (0..1) drawn as a bar beneath the value. */
  bar?: number | null;
}

export function MetricCard({ label, value, hint, tone = "neutral", icon, bar }: MetricCardProps) {
  return (
    <div
      className={`rounded-lg border border-line-subtle border-t-4 bg-surface-raised p-4 shadow-sm ${ACCENT_CLASSES[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">{label}</p>
        {icon ? (
          <span
            aria-hidden="true"
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${ICON_CLASSES[tone]}`}
          >
            <Icon name={icon} size={16} />
          </span>
        ) : null}
      </div>
      {value === null ? (
        <p className="mt-2 text-sm text-fg-muted">{NO_DATA_MESSAGE}</p>
      ) : (
        <p className={`mt-1 text-3xl font-semibold tabular-nums ${VALUE_TONE_CLASSES[tone]}`}>
          {value}
        </p>
      )}
      {bar !== undefined && value !== null ? (
        <RateBar value={bar} tone={tone} className="mt-3" />
      ) : null}
      {hint ? <p className="mt-1.5 text-xs text-fg-secondary">{hint}</p> : null}
    </div>
  );
}
