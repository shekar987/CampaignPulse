import type { DeliveryEvent } from "@campaignpulse/event-contracts";

import type { Logger } from "../logging/logger";
import type { EventBus, EventHandler, PoisonMessageHandler, PublishOptions } from "./event-bus";

export interface LocalEventBusOptions {
  logger: Logger;
  /** How many times a message is delivered before it is treated as poison (SQS maxReceiveCount). */
  maxReceiveCount?: number;
  /** Concurrent handler invocations, like several Lambda instances draining a queue. */
  concurrency?: number;
  /** Multiplier applied to publish delays so demos can compress the retry backoff. */
  delayScale?: number;
  /** Deliver every message this many times (>= 2) to exercise idempotency in tests. */
  duplicateDeliveries?: number;
  onPoisonMessage?: PoisonMessageHandler;
}

interface QueuedMessage {
  event: DeliveryEvent;
  receiveCount: number;
}

/**
 * In-memory transport with the semantics that matter for correctness: asynchronous, at-least-once
 * delivery, per-message delay, redelivery on handler failure and a poison-message hand-off after
 * `maxReceiveCount` attempts. It deliberately mirrors how SQS behaves so the same processor code
 * runs unchanged in AWS.
 */
export class LocalEventBus implements EventBus {
  private readonly queue: QueuedMessage[] = [];
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private readonly idleWaiters: (() => void)[] = [];
  private handler: EventHandler | null = null;
  private active = 0;
  private closed = false;
  private draining = false;
  private readonly logger: Logger;
  private readonly maxReceiveCount: number;
  private readonly concurrency: number;
  private readonly delayScale: number;
  private readonly duplicateDeliveries: number;
  private readonly onPoisonMessage: PoisonMessageHandler | undefined;

  constructor(options: LocalEventBusOptions) {
    this.logger = options.logger.child({ component: "local-event-bus" });
    this.maxReceiveCount = options.maxReceiveCount ?? 3;
    this.concurrency = Math.max(1, options.concurrency ?? 4);
    this.delayScale = options.delayScale ?? 1;
    this.duplicateDeliveries = Math.max(1, options.duplicateDeliveries ?? 1);
    this.onPoisonMessage = options.onPoisonMessage;
  }

  subscribe(handler: EventHandler): void {
    this.handler = handler;
    this.drain();
  }

  async publish(event: DeliveryEvent, options: PublishOptions = {}): Promise<void> {
    if (this.closed) {
      throw new Error("LocalEventBus is closed");
    }
    const delayMs = Math.max(0, Math.round((options.delaySeconds ?? 0) * 1000 * this.delayScale));
    for (let copy = 0; copy < this.duplicateDeliveries; copy += 1) {
      const message: QueuedMessage = { event, receiveCount: 0 };
      if (delayMs === 0) {
        this.queue.push(message);
      } else {
        const timer = setTimeout(() => {
          this.timers.delete(timer);
          this.queue.push(message);
          this.drain();
        }, delayMs);
        this.timers.add(timer);
      }
    }
    this.drain();
  }

  async publishBatch(events: DeliveryEvent[], options: PublishOptions = {}): Promise<void> {
    for (const event of events) {
      await this.publish(event, options);
    }
  }

  /** Messages queued or delayed but not yet handled. */
  get pending(): number {
    return this.queue.length + this.timers.size + this.active;
  }

  /** Resolves once every queued, delayed and in-flight message has been handled. */
  idle(): Promise<void> {
    if (this.pending === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  close(): void {
    this.closed = true;
    for (const timer of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.queue.length = 0;
    this.draining = false;
    for (const resolve of this.idleWaiters.splice(0)) {
      resolve();
    }
  }

  private drain(): void {
    if (!this.handler || this.closed || this.draining || this.queue.length === 0) {
      return;
    }
    // Dispatch on a later tick so `publish` always returns before a handler runs, like a real
    // queue, and so a handler that publishes never re-enters itself.
    this.draining = true;
    setImmediate(() => {
      this.draining = false;
      this.dispatch();
    });
  }

  private dispatch(): void {
    if (!this.handler || this.closed) {
      return;
    }
    while (this.active < this.concurrency && this.queue.length > 0) {
      const message = this.queue.shift();
      if (!message) {
        break;
      }
      this.active += 1;
      void this.deliver(message).finally(() => {
        this.active -= 1;
        this.notifyIfIdle();
        this.drain();
      });
    }
    this.notifyIfIdle();
  }

  private async deliver(message: QueuedMessage): Promise<void> {
    const handler = this.handler;
    if (!handler) {
      return;
    }
    message.receiveCount += 1;
    try {
      await handler(message.event);
    } catch (error) {
      if (message.receiveCount >= this.maxReceiveCount) {
        this.logger.error(
          { err: error, eventId: message.event.id, receiveCount: message.receiveCount },
          "message failed too many times; handing to poison-message handler",
        );
        if (this.onPoisonMessage) {
          try {
            await this.onPoisonMessage(message.event, error);
          } catch (poisonError) {
            this.logger.error({ err: poisonError }, "poison-message handler failed");
          }
        }
        return;
      }
      this.logger.warn(
        { err: error, eventId: message.event.id, receiveCount: message.receiveCount },
        "message handler failed; redelivering",
      );
      this.queue.push(message);
    }
  }

  private notifyIfIdle(): void {
    if (this.pending === 0) {
      const waiters = this.idleWaiters.splice(0);
      for (const resolve of waiters) {
        resolve();
      }
    }
  }
}
