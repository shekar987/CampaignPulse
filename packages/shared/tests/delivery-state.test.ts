import { describe, expect, it } from "vitest";

import {
  DELIVERY_EVENT_STATUS,
  InvalidTransitionError,
  assertTransition,
  canTransition,
  isTerminalStatus,
  transitionSources,
} from "../src";

describe("delivery status transitions", () => {
  it("follows the happy path", () => {
    expect(canTransition("PENDING", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "SUCCESS")).toBe(true);
  });

  it("follows the retry path", () => {
    expect(canTransition("PROCESSING", "FAILED")).toBe(true);
    expect(canTransition("FAILED", "RETRYING")).toBe(true);
    expect(canTransition("RETRYING", "PROCESSING")).toBe(true);
    expect(canTransition("FAILED", "FINAL_FAILURE")).toBe(true);
  });

  it("never lets a completed delivery become a failure", () => {
    expect(canTransition("SUCCESS", "FAILED")).toBe(false);
    expect(canTransition("SUCCESS", "PROCESSING")).toBe(false);
    expect(canTransition("FINAL_FAILURE", "RETRYING")).toBe(false);
    expect(isTerminalStatus("SUCCESS")).toBe(true);
    expect(isTerminalStatus("FINAL_FAILURE")).toBe(true);
    expect(isTerminalStatus("RETRYING")).toBe(false);
  });

  it("rejects skipping the processing step", () => {
    expect(canTransition("PENDING", "SUCCESS")).toBe(false);
    expect(canTransition("RETRYING", "SUCCESS")).toBe(false);
  });

  it("lists the statuses that may precede a target status", () => {
    expect(transitionSources("PROCESSING").sort()).toEqual(["PENDING", "RETRYING"]);
    expect(transitionSources("FINAL_FAILURE")).toEqual(["FAILED"]);
  });

  it("throws a descriptive error for an invalid transition", () => {
    expect(() => assertTransition("SUCCESS", "FAILED")).toThrow(InvalidTransitionError);
    expect(() => assertTransition("SUCCESS", "FAILED")).toThrow(
      "Cannot move a delivery from SUCCESS to FAILED",
    );
    expect(() => assertTransition("FAILED", "RETRYING")).not.toThrow();
  });

  it("maps every delivery event type to the status it reports", () => {
    expect(DELIVERY_EVENT_STATUS.CAMPAIGN_DELIVERY_REQUESTED).toBe("PENDING");
    expect(DELIVERY_EVENT_STATUS.DELIVERY_RETRY_SUCCEEDED).toBe("SUCCESS");
    expect(DELIVERY_EVENT_STATUS.DELIVERY_FINAL_FAILURE).toBe("FINAL_FAILURE");
    expect(DELIVERY_EVENT_STATUS.INCIDENT_CREATED).toBeUndefined();
  });
});
