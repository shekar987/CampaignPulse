import { PublishCommand, type SNSClient } from "@aws-sdk/client-sns";

import type { Logger } from "../logging/logger";
import type { Notification, NotificationPublisher } from "../notifications/notification-publisher";

export type SnsSender = Pick<SNSClient, "send">;

export interface SnsNotificationPublisherOptions {
  topicArn: string;
  client: SnsSender;
  logger: Logger;
}

/** SNS subjects are limited to 100 printable ASCII characters. */
function subjectFor(notification: Notification): string {
  return notification.subject.replace(/[^\x20-\x7e]/g, "").slice(0, 100) || notification.type;
}

/**
 * Publishes incident and dead-letter notifications to an SNS topic. Subscribers (email, chat
 * webhooks, pagers) can filter on the message attributes, e.g. only critical incidents.
 */
export class SnsNotificationPublisher implements NotificationPublisher {
  private readonly logger: Logger;

  constructor(private readonly options: SnsNotificationPublisherOptions) {
    this.logger = options.logger.child({ component: "sns-notifications" });
  }

  async publish(notification: Notification): Promise<void> {
    const attributes = Object.fromEntries(
      Object.entries({ type: notification.type, ...notification.attributes }).map(
        ([key, value]) => [key, { DataType: "String", StringValue: value }],
      ),
    );
    await this.options.client.send(
      new PublishCommand({
        TopicArn: this.options.topicArn,
        Subject: subjectFor(notification),
        Message: JSON.stringify(
          {
            type: notification.type,
            subject: notification.subject,
            message: notification.message,
            ...notification.attributes,
          },
          null,
          2,
        ),
        MessageAttributes: attributes,
      }),
    );
    this.logger.info(
      { notificationType: notification.type, ...notification.attributes },
      "notification published",
    );
  }
}
