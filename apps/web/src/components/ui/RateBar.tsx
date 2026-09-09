import type { Tone } from "../../lib/health";

const FILL_CLASSES: Record<Tone, string> = {
  success: "bg-status-success-solid",
  warning: "bg-status-warning-solid",
  error: "bg-status-error-solid",
  neutral: "bg-status-neutral-solid",
  info: "bg-status-info-solid",
};

export interface RateBarProps {
  /** Fraction between 0 and 1; null renders an empty track. */
  value: number | null | undefined;
  tone?: Tone;
  className?: string;
}

/**
 * A thin horizontal bar for a rate. Decorative: the number it accompanies carries the meaning,
 * so the bar is hidden from assistive technology.
 */
export function RateBar({ value, tone = "neutral", className = "" }: RateBarProps) {
  const percent = value === null || value === undefined ? 0 : Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      aria-hidden="true"
      className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${FILL_CLASSES[tone]}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
