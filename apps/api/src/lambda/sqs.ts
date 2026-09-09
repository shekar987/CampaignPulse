import type { DeliveryEvent } from "@campaignpulse/event-contracts";
import type { SQSBatchItemFailure, SQSRecord } from "aws-lambda";

export interface ParsedRecord {
  messageId: string;
  event: DeliveryEvent | null;
  error?: string;
}

/** Parses SQS record bodies into events; a malformed body yields `event: null`. */
export function parseRecords(records: SQSRecord[]): ParsedRecord[] {
  return records.map((record) => {
    try {
      const parsed = JSON.parse(record.body) as unknown;
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        typeof (parsed as { id?: unknown }).id !== "string"
      ) {
        return { messageId: record.messageId, event: null, error: "body is not a delivery event" };
      }
      return { messageId: record.messageId, event: parsed as DeliveryEvent };
    } catch (error) {
      return {
        messageId: record.messageId,
        event: null,
        error: error instanceof Error ? error.message : "invalid JSON",
      };
    }
  });
}

/** Builds the partial-batch response so only failed messages return to the queue. */
export function batchItemFailures(messageIds: string[]): {
  batchItemFailures: SQSBatchItemFailure[];
} {
  return { batchItemFailures: messageIds.map((itemIdentifier) => ({ itemIdentifier })) };
}
