import type { DeliveryEvent } from "@campaignpulse/event-contracts";
import {
  SendMessageBatchCommand,
  SendMessageCommand,
  type SQSClient,
  type SendMessageBatchRequestEntry,
} from "@aws-sdk/client-sqs";

import type { EventBus, PublishOptions } from "../events/event-bus";
import type { Logger } from "../logging/logger";

/** The one method this bus needs from the SQS client, so tests can pass a stub. */
export type SqsSender = Pick<SQSClient, "send">;

export interface SqsEventBusOptions {
  queueUrl: string;
  client: SqsSender;
  logger: Logger;
}

/** SQS caps per-message delay at 15 minutes. */
const MAX_DELAY_SECONDS = 900;
const BATCH_SIZE = 10;

function messageAttributes(event: DeliveryEvent) {
  return {
    eventType: { DataType: "String", StringValue: event.eventType },
    campaignId: { DataType: "String", StringValue: event.campaignId },
    correlationId: { DataType: "String", StringValue: event.correlationId },
    channel: { DataType: "String", StringValue: event.channel },
  };
}

function delaySeconds(options: PublishOptions | undefined): number {
  return Math.min(MAX_DELAY_SECONDS, Math.max(0, Math.round(options?.delaySeconds ?? 0)));
}

/**
 * Publishes delivery events to an SQS queue. Retry backoff maps onto `DelaySeconds`, and the
 * queue's redrive policy (maxReceiveCount) plays the poison-message role the local bus
 * emulates in memory.
 */
export class SqsEventBus implements EventBus {
  private readonly logger: Logger;

  constructor(private readonly options: SqsEventBusOptions) {
    this.logger = options.logger.child({ component: "sqs-event-bus" });
  }

  async publish(event: DeliveryEvent, options?: PublishOptions): Promise<void> {
    await this.options.client.send(
      new SendMessageCommand({
        QueueUrl: this.options.queueUrl,
        MessageBody: JSON.stringify(event),
        DelaySeconds: delaySeconds(options),
        MessageAttributes: messageAttributes(event),
      }),
    );
    this.logger.debug({ eventId: event.id, eventType: event.eventType }, "event published");
  }

  async publishBatch(events: DeliveryEvent[], options?: PublishOptions): Promise<void> {
    for (let start = 0; start < events.length; start += BATCH_SIZE) {
      const chunk = events.slice(start, start + BATCH_SIZE);
      const entries: SendMessageBatchRequestEntry[] = chunk.map((event, index) => ({
        Id: String(index),
        MessageBody: JSON.stringify(event),
        DelaySeconds: delaySeconds(options),
        MessageAttributes: messageAttributes(event),
      }));
      const result = await this.options.client.send(
        new SendMessageBatchCommand({ QueueUrl: this.options.queueUrl, Entries: entries }),
      );
      const failed = result.Failed ?? [];
      if (failed.length > 0) {
        const ids = failed.map((entry) => chunk[Number(entry.Id)]?.id ?? entry.Id).join(", ");
        this.logger.error({ failed }, "some events were not accepted by SQS");
        throw new Error(`SQS rejected ${failed.length} event(s): ${ids}`);
      }
    }
    this.logger.info({ count: events.length }, "events published");
  }
}
