import type { ErrorCode } from "@campaignpulse/event-contracts";

/** A delivery is attempted at most this many times before it is dead-lettered. */
export const MAX_DELIVERY_ATTEMPTS = 3;

/**
 * Seconds to wait before attempt `n` (index `n - 1`): the first attempt is immediate, the
 * second waits 5 seconds and the third 30 seconds. Exponential backoff gives a struggling
 * dependency room to recover instead of hammering it.
 */
export const RETRY_BACKOFF_SECONDS: readonly number[] = [0, 5, 30];

/**
 * Failures that describe a transient condition. Retrying them has a real chance of success.
 * RATE_LIMITED and UNKNOWN_ERROR are treated as transient too: the backoff schedule spreads
 * retries out, and an unknown failure is more often a blip than a permanent fault.
 */
export const RETRYABLE_ERROR_CODES: readonly ErrorCode[] = [
  "TIMEOUT",
  "NETWORK_ERROR",
  "DEPENDENCY_UNAVAILABLE",
  "RATE_LIMITED",
  "UNKNOWN_ERROR",
];

/**
 * Failures caused by the request itself. Sending the same invalid payload or the same rejected
 * credentials again cannot succeed, so these go straight to the dead-letter queue.
 */
export const NON_RETRYABLE_ERROR_CODES: readonly ErrorCode[] = [
  "VALIDATION_ERROR",
  "AUTHORIZATION_ERROR",
];

export function isRetryableError(code: ErrorCode): boolean {
  return RETRYABLE_ERROR_CODES.includes(code);
}

export type DeadLetterReason = "RETRIES_EXHAUSTED" | "NON_RETRYABLE_ERROR" | "PROCESSING_FAILURE";

export type RetryDecision =
  | { action: "retry"; nextAttempt: number; delaySeconds: number }
  | { action: "dead-letter"; reason: Exclude<DeadLetterReason, "PROCESSING_FAILURE"> };

export interface RetryPolicyOptions {
  maxAttempts?: number;
  backoffSeconds?: readonly number[];
}

/**
 * Decides what happens after attempt `attempt` failed with `errorCode`.
 */
export function decideRetry(
  errorCode: ErrorCode,
  attempt: number,
  options: RetryPolicyOptions = {},
): RetryDecision {
  const maxAttempts = options.maxAttempts ?? MAX_DELIVERY_ATTEMPTS;
  const backoff = options.backoffSeconds ?? RETRY_BACKOFF_SECONDS;

  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new RangeError("attempt must be a positive integer");
  }
  if (!isRetryableError(errorCode)) {
    return { action: "dead-letter", reason: "NON_RETRYABLE_ERROR" };
  }
  if (attempt >= maxAttempts) {
    return { action: "dead-letter", reason: "RETRIES_EXHAUSTED" };
  }

  const nextAttempt = attempt + 1;
  const delaySeconds = backoff[nextAttempt - 1] ?? backoff[backoff.length - 1] ?? 0;
  return { action: "retry", nextAttempt, delaySeconds };
}
