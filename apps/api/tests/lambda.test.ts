import type { APIGatewayProxyEventV2, SQSRecord } from "aws-lambda";
import { describe, expect, it } from "vitest";

import { toRequest, toResult } from "../src/lambda/http";
import { batchItemFailures, parseRecords } from "../src/lambda/sqs";

function apiGatewayEvent(overrides: Partial<APIGatewayProxyEventV2> = {}): APIGatewayProxyEventV2 {
  return {
    version: "2.0",
    routeKey: "ANY /graphql",
    rawPath: "/graphql",
    rawQueryString: "",
    headers: { "content-type": "application/json", host: "api.example.com" },
    requestContext: {
      accountId: "123456789012",
      apiId: "abc",
      domainName: "api.example.com",
      domainPrefix: "api",
      http: {
        method: "POST",
        path: "/graphql",
        protocol: "HTTP/1.1",
        sourceIp: "1.2.3.4",
        userAgent: "test",
      },
      requestId: "req",
      routeKey: "ANY /graphql",
      stage: "$default",
      time: "now",
      timeEpoch: 0,
    },
    body: JSON.stringify({ query: "{ status { name } }" }),
    isBase64Encoded: false,
    ...overrides,
  };
}

describe("API Gateway adapter", () => {
  it("builds a fetch Request from a v2 event", async () => {
    const request = toRequest(apiGatewayEvent({ rawQueryString: "a=1" }));
    expect(request.url).toBe("https://api.example.com/graphql?a=1");
    expect(request.method).toBe("POST");
    expect(request.headers.get("content-type")).toBe("application/json");
    expect(await request.text()).toContain("status");
  });

  it("decodes base64 bodies and omits bodies on GET", async () => {
    const encoded = toRequest(
      apiGatewayEvent({
        body: Buffer.from('{"query":"{ x }"}').toString("base64"),
        isBase64Encoded: true,
      }),
    );
    expect(await encoded.text()).toBe('{"query":"{ x }"}');

    const get = toRequest(
      apiGatewayEvent({
        requestContext: {
          ...apiGatewayEvent().requestContext,
          http: { ...apiGatewayEvent().requestContext.http, method: "GET" },
        },
        body: undefined,
      }),
    );
    expect(get.method).toBe("GET");
    expect(get.body).toBeNull();
  });

  it("converts a Response into a v2 result", async () => {
    const result = await toResult(
      new Response('{"data":{}}', {
        status: 200,
        headers: { "content-type": "application/json", "set-cookie": "a=b" },
      }),
    );
    expect(result).toMatchObject({
      statusCode: 200,
      headers: { "content-type": "application/json" },
      cookies: ["a=b"],
      body: '{"data":{}}',
      isBase64Encoded: false,
    });
  });
});

describe("SQS record parsing", () => {
  const record = (messageId: string, body: string): SQSRecord =>
    ({
      messageId,
      body,
      receiptHandle: "r",
      attributes: {},
      messageAttributes: {},
    }) as unknown as SQSRecord;

  it("parses well-formed bodies and flags the rest", () => {
    const parsed = parseRecords([
      record("m1", JSON.stringify({ id: "e1", eventType: "CAMPAIGN_DELIVERY_REQUESTED" })),
      record("m2", "not json"),
      record("m3", JSON.stringify({ hello: "world" })),
    ]);
    expect(parsed[0]).toMatchObject({ messageId: "m1", event: { id: "e1" } });
    expect(parsed[1]).toMatchObject({ messageId: "m2", event: null });
    expect(parsed[1]?.error).toBeDefined();
    expect(parsed[2]).toMatchObject({
      messageId: "m3",
      event: null,
      error: "body is not a delivery event",
    });
  });

  it("formats partial batch failures", () => {
    expect(batchItemFailures(["m2", "m3"])).toEqual({
      batchItemFailures: [{ itemIdentifier: "m2" }, { itemIdentifier: "m3" }],
    });
  });
});
