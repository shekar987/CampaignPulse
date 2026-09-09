import { describe, expect, it } from "vitest";

import { loadConfig } from "../src/config";

const validEnv = {
  DATABASE_URL: "postgresql://campaignpulse:campaignpulse@localhost:5432/campaignpulse",
};

describe("loadConfig", () => {
  it("applies defaults for optional settings", () => {
    const config = loadConfig(validEnv);
    expect(config).toEqual({
      NODE_ENV: "development",
      PORT: 4000,
      LOG_LEVEL: "info",
      DATABASE_URL: validEnv.DATABASE_URL,
      EVENT_BUS: "local",
      NOTIFICATIONS: "log",
      LOCAL_BUS_CONCURRENCY: 4,
      RETRY_BACKOFF_SCALE: 1,
      SIMULATION_LATENCY_SCALE: 0.05,
    });
  });

  it("requires the queue url when the SQS transport is selected", () => {
    expect(() => loadConfig({ ...validEnv, EVENT_BUS: "sqs" })).toThrow(/DELIVERY_QUEUE_URL/);
    expect(
      loadConfig({
        ...validEnv,
        EVENT_BUS: "sqs",
        DELIVERY_QUEUE_URL: "https://sqs.eu-west-2.amazonaws.com/123456789012/delivery",
      }).EVENT_BUS,
    ).toBe("sqs");
  });

  it("requires the topic arn when SNS notifications are selected", () => {
    expect(() => loadConfig({ ...validEnv, NOTIFICATIONS: "sns" })).toThrow(/INCIDENT_TOPIC_ARN/);
  });

  it("coerces PORT from a string", () => {
    expect(loadConfig({ ...validEnv, PORT: "8080" }).PORT).toBe(8080);
  });

  it("rejects a missing database url with a readable message", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it("rejects a database url that is not postgresql", () => {
    expect(() => loadConfig({ DATABASE_URL: "mysql://localhost/db" })).toThrow(
      /postgresql:\/\/ connection string/,
    );
  });

  it("rejects an unknown log level", () => {
    expect(() => loadConfig({ ...validEnv, LOG_LEVEL: "loud" })).toThrow(/LOG_LEVEL/);
  });
});
