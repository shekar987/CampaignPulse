import type { ReactNode } from "react";

import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon = "inbox", title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-12 text-center">
      <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-sunken text-fg-muted">
        <Icon name={icon} size={20} />
      </span>
      <h3 className="text-base font-semibold text-fg-primary">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-(--container-md) text-sm text-fg-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retrying = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-lg border border-status-error-border bg-status-error-bg p-4 text-status-error-fg sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <Icon name="alert-octagon" size={20} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm">{message}</p>
        </div>
      </div>
      {onRetry ? (
        <Button
          size="sm"
          onClick={onRetry}
          disabled={retrying}
          icon={<Icon name="refresh" size={16} />}
        >
          {retrying ? "Retrying…" : "Try again"}
        </Button>
      ) : null}
    </div>
  );
}

export interface SkeletonProps {
  className?: string;
}

/** Placeholder block shown while data loads. Decorative; announce loading at the region level. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div aria-hidden="true" className={`animate-pulse rounded-md bg-surface-sunken ${className}`} />
  );
}

export interface LoadingRegionProps {
  label: string;
  children: ReactNode;
}

/** Wraps skeletons so assistive technology hears one "loading" announcement, not each block. */
export function LoadingRegion({ label, children }: LoadingRegionProps) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
