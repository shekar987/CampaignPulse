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
    });
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
