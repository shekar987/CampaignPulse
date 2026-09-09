import { describe, expect, it } from "vitest";

import {
  MAX_DELIVERY_ATTEMPTS,
  NON_RETRYABLE_ERROR_CODES,
  RETRYABLE_ERROR_CODES,
  RETRY_BACKOFF_SECONDS,
  decideRetry,
  isRetryableError,
} from "../src";

describe("retry policy", () => {
  it("classifies transient failures as retryable and request faults as not", () => {
    expect(isRetryableError("TIMEOUT")).toBe(true);
    expect(isRetryableError("NETWORK_ERROR")).toBe(true);
    expect(isRetryableError("DEPENDENCY_UNAVAILABLE")).toBe(true);
    expect(isRetryableError("VALIDATION_ERROR")).toBe(false);
    expect(isRetryableError("AUTHORIZATION_ERROR")).toBe(false);
  });

  it("covers every error code exactly once", () => {
    const all = [...RETRYABLE_ERROR_CODES, ...NON_RETRYABLE_ERROR_CODES].sort();
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(7);
  });

  it("schedules exponential backoff: immediate, 5 seconds, 30 seconds", () => {
    expect(RETRY_BACKOFF_SECONDS).toEqual([0, 5, 30]);
    expect(decideRetry("TIMEOUT", 1)).toEqual({ action: "retry", nextAttempt: 2, delaySeconds: 5 });
    expect(decideRetry("TIMEOUT", 2)).toEqual({
      action: "retry",
      nextAttempt: 3,
      delaySeconds: 30,
    });
  });

  it("dead-letters after the maximum number of attempts", () => {
    expect(MAX_DELIVERY_ATTEMPTS).toBe(3);
    expect(decideRetry("TIMEOUT", 3)).toEqual({
      action: "dead-letter",
      reason: "RETRIES_EXHAUSTED",
    });
  });

  it("never retries a non-retryable error, even on the first attempt", () => {
    expect(decideRetry("VALIDATION_ERROR", 1)).toEqual({
      action: "dead-letter",
      reason: "NON_RETRYABLE_ERROR",
    });
  });

  it("supports custom attempt limits and backoff schedules", () => {
    expect(decideRetry("TIMEOUT", 3, { maxAttempts: 5, backoffSeconds: [0, 1, 2, 4] })).toEqual({
      action: "retry",
      nextAttempt: 4,
      delaySeconds: 4,
    });
    expect(decideRetry("TIMEOUT", 4, { maxAttempts: 5, backoffSeconds: [0, 1] })).toEqual({
      action: "retry",
      nextAttempt: 5,
      delaySeconds: 1,
    });
  });

  it("rejects impossible attempt numbers", () => {
    expect(() => decideRetry("TIMEOUT", 0)).toThrow(RangeError);
  });
});
