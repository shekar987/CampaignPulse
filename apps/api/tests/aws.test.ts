import type { DeliveryEvent } from "@campaignpulse/event-contracts";
import { SendMessageCommand, type SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { PublishCommand } from "@aws-sdk/client-sns";
import { GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";

import { connectionStringFromSecret, createDatabaseUrlResolver } from "../src/aws/secrets";
import { SnsNotificationPublisher } from "../src/aws/sns-notification-publisher";
import { SqsEventBus, type SqsSender } from "../src/aws/sqs-event-bus";

const logger = pino({ level: "silent" });

function event(id: string): DeliveryEvent {
  return {
    id,
    campaignId: "0192b1c2-7f3e-7a4b-9c1d-2e3f4a5b6c7e",
    correlationId: `cmp-${id}`,
    eventType: "CAMPAIGN_DELIVERY_REQUESTED",
    channel: "WEB",
    status: "PENDING",
    attempt: 1,
    occurredAt: "2026-09-09T10:00:00.000Z",
  };
}

describe("SqsEventBus", () => {
  it("sends a single event with the retry delay and routing attributes", async () => {
    const send = vi.fn(async (_command: unknown) => ({}));
    const bus = new SqsEventBus({
      queueUrl: "https://sqs.eu-west-2.amazonaws.com/123456789012/delivery",
      client: { send } as unknown as SqsSender,
      logger,
    });
    await bus.publish(event("a"), { delaySeconds: 30 });

    const command = send.mock.calls[0]?.[0] as SendMessageCommand;
    expect(command).toBeInstanceOf(SendMessageCommand);
    expect(command.input).toMatchObject({
      QueueUrl: "https://sqs.eu-west-2.amazonaws.com/123456789012/delivery",
      DelaySeconds: 30,
      MessageAttributes: { eventType: { StringValue: "CAMPAIGN_DELIVERY_REQUESTED" } },
    });
    expect(JSON.parse(command.input.MessageBody ?? "")).toEqual(event("a"));
  });

  it("caps the delay at the SQS maximum", async () => {
    const send = vi.fn(async (_command: unknown) => ({}));
    const bus = new SqsEventBus({
      queueUrl: "q",
      client: { send } as unknown as SqsSender,
      logger,
    });
    await bus.publish(event("a"), { delaySeconds: 5000 });
    expect((send.mock.calls[0]?.[0] as SendMessageCommand).input.DelaySeconds).toBe(900);
  });

  it("splits batches into chunks of ten", async () => {
    const send = vi.fn(async (_command: unknown) => ({ Failed: [] }));
    const bus = new SqsEventBus({
      queueUrl: "q",
      client: { send } as unknown as SqsSender,
      logger,
    });
    await bus.publishBatch(Array.from({ length: 23 }, (_, i) => event(String(i))));
    expect(send).toHaveBeenCalledTimes(3);
    const sizes = send.mock.calls.map(
      (call) => (call[0] as SendMessageBatchCommand).input.Entries?.length,
    );
    expect(sizes).toEqual([10, 10, 3]);
  });

  it("fails loudly when SQS rejects part of a batch", async () => {
    const send = vi.fn(async (_command: unknown) => ({
      Failed: [{ Id: "1", Message: "throttled" }],
    }));
    const bus = new SqsEventBus({
      queueUrl: "q",
      client: { send } as unknown as SqsSender,
      logger,
    });
    await expect(bus.publishBatch([event("x"), event("y")])).rejects.toThrow(/rejected 1 event.*y/);
  });
});

describe("SnsNotificationPublisher", () => {
  it("publishes with a bounded subject and filterable attributes", async () => {
    const send = vi.fn(async (_command: unknown) => ({}));
    const publisher = new SnsNotificationPublisher({
      topicArn: "arn:aws:sns:eu-west-2:123456789012:incidents",
      client: { send } as never,
      logger,
    });
    await publisher.publish({
      type: "INCIDENT_CREATED",
      subject: `Critical incident: ${"x".repeat(200)}`,
      message: "SmartShop error rate 18%",
      attributes: { campaignId: "c1", severity: "CRITICAL" },
    });
    const command = send.mock.calls[0]?.[0] as PublishCommand;
    expect(command).toBeInstanceOf(PublishCommand);
    expect(command.input.Subject?.length).toBe(100);
    expect(command.input.MessageAttributes).toMatchObject({
      type: { StringValue: "INCIDENT_CREATED" },
      severity: { StringValue: "CRITICAL" },
    });
    expect(JSON.parse(command.input.Message ?? "")).toMatchObject({
      message: "SmartShop error rate 18%",
      campaignId: "c1",
    });
  });
});

describe("database secret resolution", () => {
  it("accepts a plain connection string", () => {
    expect(connectionStringFromSecret(" postgresql://u:p@h:5432/db ")).toBe(
      "postgresql://u:p@h:5432/db",
    );
  });

  it("builds a connection string from an RDS-managed secret", () => {
    const url = connectionStringFromSecret(
      JSON.stringify({
        username: "app user",
        password: "p@ss/word",
        host: "db.example",
        port: 5432,
        dbname: "campaignpulse",
      }),
    );
    expect(url).toBe(
      "postgresql://app%20user:p%40ss%2Fword@db.example:5432/campaignpulse?sslmode=require",
    );
  });

  it("rejects secrets that are neither", () => {
    expect(() => connectionStringFromSecret("nope")).toThrow(/neither/);
    expect(() => connectionStringFromSecret('{"username":"u"}')).toThrow(/must contain/);
  });

  it("prefers DATABASE_URL and otherwise fetches the secret once", async () => {
    const send = vi.fn(async (_command: unknown) => ({
      SecretString: "postgresql://s:s@secret/db",
    }));
    const resolve = createDatabaseUrlResolver(() => ({ send }) as never);

    expect(await resolve({ DATABASE_URL: "postgresql://env/db" })).toBe("postgresql://env/db");
    expect(send).not.toHaveBeenCalled();

    const env = { DATABASE_SECRET_ARN: "arn:aws:secretsmanager:eu-west-2:1:secret:db" };
    expect(await resolve(env)).toBe("postgresql://s:s@secret/db");
    expect(await resolve(env)).toBe("postgresql://s:s@secret/db");
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(GetSecretValueCommand);
  });

  it("fails when neither source is configured", async () => {
    const resolve = createDatabaseUrlResolver(() => ({ send: vi.fn() }) as never);
    await expect(resolve({})).rejects.toThrow(/DATABASE_URL or DATABASE_SECRET_ARN/);
  });
});
