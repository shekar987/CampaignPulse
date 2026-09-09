import type { EventStatus, EventType } from "@campaignpulse/event-contracts";

/**
 * Allowed status transitions for a single delivery (one correlation id).
 *
 * SUCCESS and FINAL_FAILURE are terminal. A late or duplicate message can therefore never turn
 * a delivery that already succeeded into a failure: the transition is rejected instead.
 */
export const DELIVERY_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  PENDING: ["PROCESSING"],
  PROCESSING: ["SUCCESS", "FAILED"],
  FAILED: ["RETRYING", "FINAL_FAILURE"],
  RETRYING: ["PROCESSING"],
  SUCCESS: [],
  FINAL_FAILURE: [],
};

export const TERMINAL_DELIVERY_STATUSES: readonly EventStatus[] = ["SUCCESS", "FINAL_FAILURE"];

export function canTransition(from: EventStatus, to: EventStatus): boolean {
  return DELIVERY_TRANSITIONS[from].includes(to);
}

export function isTerminalStatus(status: EventStatus): boolean {
  return TERMINAL_DELIVERY_STATUSES.includes(status);
}

/** Statuses a delivery may be in immediately before moving to `to`. */
export function transitionSources(to: EventStatus): EventStatus[] {
  return (Object.keys(DELIVERY_TRANSITIONS) as EventStatus[]).filter((from) =>
    DELIVERY_TRANSITIONS[from].includes(to),
  );
}

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: EventStatus,
    readonly to: EventStatus,
  ) {
    super(`Cannot move a delivery from ${from} to ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export function assertTransition(from: EventStatus, to: EventStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

/** The delivery status each timeline event type reports. Incident events carry no status. */
export const DELIVERY_EVENT_STATUS: Partial<Record<EventType, EventStatus>> = {
  CAMPAIGN_DELIVERY_REQUESTED: "PENDING",
  DELIVERY_STARTED: "PROCESSING",
  DELIVERY_SUCCEEDED: "SUCCESS",
  DELIVERY_FAILED: "FAILED",
  DELIVERY_RETRY_REQUESTED: "RETRYING",
  DELIVERY_RETRY_SUCCEEDED: "SUCCESS",
  DELIVERY_FINAL_FAILURE: "FINAL_FAILURE",
};
