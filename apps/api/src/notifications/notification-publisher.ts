import type { Logger } from "../logging/logger";

export type NotificationType = "INCIDENT_CREATED" | "INCIDENT_ESCALATED" | "DELIVERY_DEAD_LETTERED";

export interface Notification {
  type: NotificationType;
  subject: string;
  message: string;
  /** Flat attributes for routing and filtering, e.g. campaignId, channel, severity. */
  attributes: Record<string, string>;
}

/**
 * Outbound alerting seam. Locally notifications are logged; in AWS they are published to an SNS
 * topic so on-call engineers can subscribe by email, chat or pager.
 */
export interface NotificationPublisher {
  publish(notification: Notification): Promise<void>;
}

export class LogNotificationPublisher implements NotificationPublisher {
  constructor(private readonly logger: Logger) {}

  async publish(notification: Notification): Promise<void> {
    this.logger.warn(
      { notificationType: notification.type, ...notification.attributes },
      `notification: ${notification.subject}`,
    );
  }
}
