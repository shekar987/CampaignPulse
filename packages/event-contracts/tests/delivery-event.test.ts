import { describe, expect, it } from "vitest";

import { DeliveryEventSchema } from "../src";

const validEvent = {
  id: "0192b1c2-7f3e-7a4b-9c1d-2e3f4a5b6c7d",
  campaignId: "0192b1c2-7f3e-7a4b-9c1d-2e3f4a5b6c7e",
  correlationId: "cmp-summer-drinks-web-001",
  eventType: "DELIVERY_FAILED",
  channel: "WEB",
  status: "FAILED",
  attempt: 1,
  occurredAt: "2026-09-08T10:32:05.000Z",
  metadata: { latencyMs: 3021 },
  error: { code: "TIMEOUT", message: "Upstream did not respond within 3000ms" },
};

describe("DeliveryEventSchema", () => {
  it("accepts a well-formed event", () => {
    const result = DeliveryEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it("accepts an event without optional metadata or error", () => {
    const { metadata: _metadata, error: _error, ...minimal } = validEvent;
    expect(DeliveryEventSchema.safeParse(minimal).success).toBe(true);
  });

  it.each([
    ["missing correlationId", { ...validEvent, correlationId: "" }],
    ["attempt below 1", { ...validEvent, attempt: 0 }],
    ["non-integer attempt", { ...validEvent, attempt: 1.5 }],
    ["unknown channel", { ...validEvent, channel: "EMAIL" }],
    ["unknown event type", { ...validEvent, eventType: "DELIVERY_EXPLODED" }],
    ["invalid timestamp", { ...validEvent, occurredAt: "yesterday" }],
    ["non-uuid id", { ...validEvent, id: "event-1" }],
    ["unknown error code", { ...validEvent, error: { code: "DISK_FULL", message: "x" } }],
    ["empty error message", { ...validEvent, error: { code: "TIMEOUT", message: "" } }],
  ])("rejects %s", (_label, candidate) => {
    expect(DeliveryEventSchema.safeParse(candidate).success).toBe(false);
  });
});
