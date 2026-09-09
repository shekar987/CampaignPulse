import type { DeliveryEvent } from "@campaignpulse/event-contracts";

export interface PublishOptions {
  /** Seconds to hold the event before it becomes visible to consumers (retry backoff). */
  delaySeconds?: number;
}

/**
 * The seam between the application and its message transport. The application only ever
 * publishes delivery events; how they are queued, delayed, redelivered and dead-lettered is the
 * transport's concern. `LocalEventBus` runs everything in-process for development and tests;
 * `SqsEventBus` sends to Amazon SQS in AWS.
 */
export interface EventBus {
  publish(event: DeliveryEvent, options?: PublishOptions): Promise<void>;
  publishBatch(events: DeliveryEvent[], options?: PublishOptions): Promise<void>;
}

export type EventHandler = (event: DeliveryEvent) => Promise<void>;

/** Called when a message has been redelivered too many times and is given up on. */
export type PoisonMessageHandler = (event: DeliveryEvent, lastError: unknown) => Promise<void>;
