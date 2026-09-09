import { describe, expect, it } from "vitest";

import { createCampaignSchema } from "../src";

const valid = {
  name: "Summer Drinks",
  advertiserName: "Fizz Beverages",
  channels: ["WEB", "MOBILE_APP"],
};

describe("createCampaignSchema", () => {
  it("accepts a valid campaign and trims whitespace", () => {
    const result = createCampaignSchema.parse({ ...valid, name: "  Summer Drinks  " });
    expect(result.name).toBe("Summer Drinks");
  });

  it("requires a name", () => {
    const result = createCampaignSchema.safeParse({ ...valid, name: "   " });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Campaign name is required");
    }
  });

  it("caps the name at 255 characters", () => {
    expect(createCampaignSchema.safeParse({ ...valid, name: "x".repeat(255) }).success).toBe(true);
    expect(createCampaignSchema.safeParse({ ...valid, name: "x".repeat(256) }).success).toBe(false);
  });

  it("requires at least one channel", () => {
    expect(createCampaignSchema.safeParse({ ...valid, channels: [] }).success).toBe(false);
  });

  it("rejects unknown and duplicate channels", () => {
    expect(createCampaignSchema.safeParse({ ...valid, channels: ["EMAIL"] }).success).toBe(false);
    expect(createCampaignSchema.safeParse({ ...valid, channels: ["WEB", "WEB"] }).success).toBe(
      false,
    );
  });
});
