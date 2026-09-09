import { describe, expect, it } from "vitest";

import {
  DEFAULT_CAMPAIGN_PAGE_SIZE,
  DEFAULT_EVENT_PAGE_SIZE,
  isUuid,
  parseCampaignListArgs,
  parseDeliveryEventListArgs,
} from "../src/graphql/args";
import { ValidationError } from "../src/services/errors";

describe("parseCampaignListArgs", () => {
  it("fills in defaults when nothing is supplied", () => {
    expect(parseCampaignListArgs({})).toEqual({
      search: undefined,
      healthStatus: undefined,
      channel: undefined,
      sort: "NEWEST",
      page: 1,
      pageSize: DEFAULT_CAMPAIGN_PAGE_SIZE,
    });
  });

  it("treats GraphQL nulls like omitted values", () => {
    const params = parseCampaignListArgs({
      filter: { search: null, healthStatus: null, channel: null },
      sort: null,
      page: null,
      pageSize: null,
    });
    expect(params.sort).toBe("NEWEST");
    expect(params.page).toBe(1);
    expect(params.search).toBeUndefined();
  });

  it("trims the search term and drops it when blank", () => {
    expect(parseCampaignListArgs({ filter: { search: "  drinks " } }).search).toBe("drinks");
    expect(parseCampaignListArgs({ filter: { search: "   " } }).search).toBeUndefined();
  });

  it("passes filters through", () => {
    const params = parseCampaignListArgs({
      filter: { healthStatus: "CRITICAL", channel: "SMARTSHOP" },
      sort: "NAME",
      page: 2,
      pageSize: 20,
    });
    expect(params).toMatchObject({
      healthStatus: "CRITICAL",
      channel: "SMARTSHOP",
      sort: "NAME",
      page: 2,
      pageSize: 20,
    });
  });

  it("rejects an oversized page", () => {
    expect(() => parseCampaignListArgs({ pageSize: 500 })).toThrow(ValidationError);
    expect(() => parseCampaignListArgs({ page: 0 })).toThrow(ValidationError);
  });

  it("rejects unknown enum values", () => {
    expect(() => parseCampaignListArgs({ filter: { channel: "EMAIL" } })).toThrow(ValidationError);
  });

  it("reports which argument failed", () => {
    try {
      parseCampaignListArgs({ pageSize: 500 });
      expect.unreachable("expected a ValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).issues).toEqual([
        { path: "pageSize", message: "pageSize must be 100 or fewer" },
      ]);
    }
  });
});

describe("parseDeliveryEventListArgs", () => {
  it("fills in defaults", () => {
    expect(parseDeliveryEventListArgs({ campaignId: "abc" })).toEqual({
      campaignId: "abc",
      channel: undefined,
      correlationId: undefined,
      page: 1,
      pageSize: DEFAULT_EVENT_PAGE_SIZE,
    });
  });

  it("keeps a correlation id filter", () => {
    expect(
      parseDeliveryEventListArgs({ campaignId: "abc", correlationId: " cmp-x-web-0001 " })
        .correlationId,
    ).toBe("cmp-x-web-0001");
  });
});

describe("isUuid", () => {
  it("accepts UUIDs and rejects anything else", () => {
    expect(isUuid("0192b1c2-7f3e-7a4b-9c1d-2e3f4a5b6c7d")).toBe(true);
    expect(isUuid("campaign-1")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});
