import type { DeliveryEvent } from "@campaignpulse/event-contracts";
import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";

import { LocalEventBus } from "../src/events/local-event-bus";

function event(id: string): DeliveryEvent {
  return {
    id,
    campaignId: "0192b1c2-7f3e-7a4b-9c1d-2e3f4a5b6c7e",
    correlationId: `cmp-${id}`,
    eventType: "CAMPAIGN_DELIVERY_REQUESTED",
    channel: "WEB",
    status: "PENDING",
    attempt: 1,
    occurredAt: new Date().toISOString(),
  };
}

const logger = pino({ level: "silent" });

describe("LocalEventBus", () => {
  it("delivers published events to the subscriber asynchronously", async () => {
    const bus = new LocalEventBus({ logger, delayScale: 0 });
    const seen: string[] = [];
    bus.subscribe(async (received) => {
      seen.push(received.id);
    });
    await bus.publish(event("a"));
    await bus.publishBatch([event("b"), event("c")]);
    expect(seen).toEqual([]);
    await bus.idle();
    expect(seen.sort()).toEqual(["a", "b", "c"]);
    bus.close();
  });

  it("holds delayed events for the scaled delay", async () => {
    vi.useFakeTimers();
    try {
      const bus = new LocalEventBus({ logger, delayScale: 0.01 });
      const seen: string[] = [];
      bus.subscribe(async (received) => {
        seen.push(received.id);
      });
      await bus.publish(event("delayed"), { delaySeconds: 30 });
      expect(bus.pending).toBe(1);
      await vi.advanceTimersByTimeAsync(299);
      expect(seen).toEqual([]);
      await vi.advanceTimersByTimeAsync(2);
      await bus.idle();
      expect(seen).toEqual(["delayed"]);
      bus.close();
    } finally {
      vi.useRealTimers();
    }
  });

  it("redelivers a failed message until it succeeds", async () => {
    const bus = new LocalEventBus({ logger, delayScale: 0, maxReceiveCount: 3 });
    let calls = 0;
    bus.subscribe(async () => {
      calls += 1;
      if (calls < 3) {
        throw new Error("transient");
      }
    });
    await bus.publish(event("flaky"));
    await bus.idle();
    expect(calls).toBe(3);
    bus.close();
  });

  it("hands a poison message to the dead-letter handler after maxReceiveCount", async () => {
    const onPoisonMessage = vi.fn(async (_event: DeliveryEvent, _error: unknown) => {});
    const bus = new LocalEventBus({ logger, delayScale: 0, maxReceiveCount: 2, onPoisonMessage });
    let calls = 0;
    bus.subscribe(async () => {
      calls += 1;
      throw new Error("always");
    });
    await bus.publish(event("poison"));
    await bus.idle();
    expect(calls).toBe(2);
    expect(onPoisonMessage).toHaveBeenCalledTimes(1);
    expect(onPoisonMessage.mock.calls[0]?.[0]).toMatchObject({ id: "poison" });
    bus.close();
  });

  it("can deliver every message twice to exercise idempotency", async () => {
    const bus = new LocalEventBus({ logger, delayScale: 0, duplicateDeliveries: 2 });
    const seen: string[] = [];
    bus.subscribe(async (received) => {
      seen.push(received.id);
    });
    await bus.publish(event("dup"));
    await bus.idle();
    expect(seen).toEqual(["dup", "dup"]);
    bus.close();
  });

  it("limits concurrent handlers", async () => {
    const bus = new LocalEventBus({ logger, delayScale: 0, concurrency: 2 });
    let inFlight = 0;
    let peak = 0;
    bus.subscribe(async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    });
    await bus.publishBatch([event("1"), event("2"), event("3"), event("4"), event("5")]);
    await bus.idle();
    expect(peak).toBe(2);
    bus.close();
  });

  it("refuses to publish after close", async () => {
    const bus = new LocalEventBus({ logger });
    bus.close();
    await expect(bus.publish(event("late"))).rejects.toThrow("closed");
  });
});
