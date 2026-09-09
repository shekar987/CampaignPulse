import {
  CAMPAIGN_STATUSES,
  CHANNELS,
  ERROR_CODES,
  EVENT_STATUSES,
  EVENT_TYPES,
  HEALTH_STATUSES,
} from "@campaignpulse/event-contracts";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import * as PrismaEnums from "../src/generated/prisma/enums";

/**
 * The event contracts are the source of truth for every enum. The Prisma schema and the GraphQL
 * schema each restate them, so these tests fail the moment one of the three copies drifts.
 */
describe("enum parity", () => {
  it.each([
    ["Channel", CHANNELS, PrismaEnums.Channel],
    ["EventType", EVENT_TYPES, PrismaEnums.EventType],
    ["EventStatus", EVENT_STATUSES, PrismaEnums.EventStatus],
    ["ErrorCode", ERROR_CODES, PrismaEnums.ErrorCode],
    ["HealthStatus", HEALTH_STATUSES, PrismaEnums.HealthStatus],
    ["CampaignStatus", CAMPAIGN_STATUSES, PrismaEnums.CampaignStatus],
  ] as const)("Prisma enum %s matches the event contracts", (_name, contract, prismaEnum) => {
    expect(Object.values(prismaEnum)).toEqual([...contract]);
  });

  const schema = readFileSync(new URL("../src/graphql/schema.graphql", import.meta.url), "utf8");

  function graphqlEnumValues(name: string): string[] {
    const match = schema.match(new RegExp(`enum ${name} \\{([^}]*)\\}`));
    if (!match?.[1]) {
      throw new Error(`enum ${name} not found in schema.graphql`);
    }
    return match[1]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));
  }

  it.each([
    ["Channel", CHANNELS],
    ["EventType", EVENT_TYPES],
    ["EventStatus", EVENT_STATUSES],
    ["ErrorCode", ERROR_CODES],
    ["HealthStatus", HEALTH_STATUSES],
    ["CampaignStatus", CAMPAIGN_STATUSES],
  ] as const)("GraphQL enum %s matches the event contracts", (name, contract) => {
    expect(graphqlEnumValues(name)).toEqual([...contract]);
  });
});
