import type { SQSBatchResponse, SQSEvent } from "aws-lambda";

import { getRuntime } from "./runtime";
import { batchItemFailures, parseRecords } from "./sqs";

/**
 * Dead-letter consumer: messages arrive here when the delivery worker failed to process them
 * `maxReceiveCount` times. Each is recorded in the dead-letter table so it shows up in the UI
 * and raises a notification. Unparseable bodies are logged and dropped: without a campaign id
 * there is nothing to attach them to.
 */
export async function handler(event: SQSEvent): Promise<SQSBatchResponse> {
  const { services, logger } = await getRuntime();
  const failed: string[] = [];

  for (const record of parseRecords(event.Records)) {
    if (!record.event) {
      logger.error(
        { messageId: record.messageId, reason: record.error },
        "unparseable message in dead-letter queue; dropping",
      );
      continue;
    }
    try {
      await services.deadLetters.recordPoisonMessage(
        record.event,
        new Error("delivery worker exceeded the maximum receive count"),
      );
    } catch (error) {
      logger.error({ err: error, messageId: record.messageId }, "could not record dead letter");
      failed.push(record.messageId);
    }
  }

  return batchItemFailures(failed);
}
