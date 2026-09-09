import type { SQSBatchResponse, SQSEvent } from "aws-lambda";

import { getRuntime } from "./runtime";
import { batchItemFailures, parseRecords } from "./sqs";

/**
 * Delivery worker: consumes CAMPAIGN_DELIVERY_REQUESTED and DELIVERY_RETRY_REQUESTED events
 * from the delivery queue. Uses partial batch responses, so one bad message never blocks the
 * other nine in the batch, and a message that keeps failing lands in the dead-letter queue
 * through the queue's redrive policy.
 */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const { processor, logger } = await getRuntime();
  const parsed = parseRecords(event.Records);
  const failed: string[] = [];

  const malformed = parsed.filter((record) => record.event === null);
  for (const record of malformed) {
    logger.error(
      { messageId: record.messageId, reason: record.error },
      "malformed delivery message",
    );
    failed.push(record.messageId);
  }

  const events = parsed.flatMap((record) => (record.event ? [record.event] : []));
  const messageIdByEventId = new Map(
    parsed.flatMap((record) =>
      record.event ? [[record.event.id, record.messageId] as const] : [],
    ),
  );

  const result = await processor.handleBatch(events);
  for (const failure of result.failures) {
    const messageId = messageIdByEventId.get(failure.eventId);
    if (messageId) {
      failed.push(messageId);
    }
  }

  logger.info(
    {
      received: event.Records.length,
      processed: result.results.filter((r) => r.status === "processed").length,
      duplicates: result.results.filter((r) => r.status === "duplicate").length,
      ignored: result.results.filter((r) => r.status === "ignored").length,
      failed: failed.length,
    },
    "delivery batch handled",
  );
  return batchItemFailures(failed);
}
