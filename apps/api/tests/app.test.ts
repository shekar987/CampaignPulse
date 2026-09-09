import { pino } from "pino";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import type { PrismaClient } from "../src/db/client";

/**
 * These tests exercise the HTTP surface of the app for operations that never reach the
 * database, so a placeholder client is enough. Database-backed behaviour is covered by the
 * integration suite that runs against PostgreSQL.
 */
function buildApp() {
  return createApp({
    db: {} as PrismaClient,
    logger: pino({ level: "silent" }),
    config: {
      NODE_ENV: "test",
      PORT: 0,
      LOG_LEVEL: "silent",
      DATABASE_URL: "postgresql://localhost:5432/test",
    },
    version: "0.1.0-test",
  });
}

async function graphql(query: string, variables?: Record<string, unknown>) {
  const app = buildApp();
  const response = await app.fetch("http://localhost/graphql", {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": "req-123" },
    body: JSON.stringify({ query, variables }),
  });
  return { response, body: (await response.json()) as { data?: unknown; errors?: unknown[] } };
}

describe("GraphQL app", () => {
  it("answers the status query", async () => {
    const { response, body } = await graphql(
      "{ status { name version environment uptimeSeconds timestamp } }",
    );
    expect(response.status).toBe(200);
    expect(body.errors).toBeUndefined();
    expect(body.data).toMatchObject({
      status: { name: "campaignpulse-api", version: "0.1.0-test", environment: "test" },
    });
  });

  it("echoes the request id header", async () => {
    const { response } = await graphql("{ status { name } }");
    expect(response.headers.get("x-request-id")).toBe("req-123");
  });

  it("returns null for a malformed campaign id without touching the database", async () => {
    const { body } = await graphql('{ campaign(id: "not-a-uuid") { id } }');
    expect(body.errors).toBeUndefined();
    expect(body.data).toEqual({ campaign: null });
  });

  it("surfaces validation problems with a BAD_USER_INPUT code", async () => {
    const { body } = await graphql(
      "mutation ($input: CreateCampaignInput!) { createCampaign(input: $input) { id } }",
      { input: { name: "   ", advertiserName: "Acme", channels: [] } },
    );
    expect(body.data).toBeNull();
    expect(body.errors).toHaveLength(1);
    expect(body.errors?.[0]).toMatchObject({
      message: "Campaign details are invalid",
      extensions: {
        code: "BAD_USER_INPUT",
        issues: expect.arrayContaining([
          { path: "name", message: "Campaign name is required" },
          { path: "channels", message: "Select at least one channel" },
        ]),
      },
    });
  });

  it("rejects an oversized page size", async () => {
    const { body } = await graphql("{ campaigns(pageSize: 1000) { totalCount } }");
    expect(body.errors?.[0]).toMatchObject({
      extensions: { code: "BAD_USER_INPUT" },
    });
  });
});
