import type { ReactNode } from "react";

import type { Tone } from "../../lib/health";

export const NO_DATA_MESSAGE = "No delivery data available";

const VALUE_TONE_CLASSES: Record<Tone, string> = {
  success: "text-status-success-fg",
  warning: "text-status-warning-fg",
  error: "text-status-error-fg",
  neutral: "text-fg-primary",
  info: "text-fg-primary",
};

export interface MetricCardProps {
  label: string;
  /** Pre-formatted value. `null` renders the explicit no-data state instead of a misleading 0. */
  value: string | null;
  hint?: ReactNode;
  tone?: Tone;
}

export function MetricCard({ label, value, hint, tone = "neutral" }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-line-subtle bg-surface-raised p-4 shadow-sm">
      <p className="text-xs font-semibold tracking-wide text-fg-muted uppercase">{label}</p>
      {value === null ? (
        <p className="mt-2 text-sm text-fg-muted">{NO_DATA_MESSAGE}</p>
      ) : (
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${VALUE_TONE_CLASSES[tone]}`}>
          {value}
        </p>
      )}
      {hint ? <p className="mt-1 text-xs text-fg-secondary">{hint}</p> : null}
    </div>
  );
}
