import { describe, expect, it } from "vitest";

import { loadBundledRdsCa, resolveConnection } from "../src/db/ssl";

const base = "postgresql://user:p%40ss@db.example.com:5432/campaignpulse";

describe("resolveConnection", () => {
  it("leaves plain local connections alone", () => {
    expect(resolveConnection(base, {})).toEqual({ connectionString: base, ssl: undefined });
    expect(resolveConnection(`${base}?sslmode=disable`, {}).ssl).toBeUndefined();
  });

  it("strips TLS parameters from the string so they cannot override explicit options", () => {
    const resolved = resolveConnection(`${base}?sslmode=require&application_name=api`, {});
    expect(resolved.connectionString).toBe(`${base}?application_name=api`);
    expect(resolved.connectionString).not.toContain("sslmode");
  });

  it("verifies RDS certificates against the bundled Amazon root CAs", () => {
    const resolved = resolveConnection(`${base}?sslmode=require`, {});
    expect(resolved.ssl?.rejectUnauthorized).toBe(true);
    expect(resolved.ssl?.ca).toContain("BEGIN CERTIFICATE");
    expect(loadBundledRdsCa()?.split("BEGIN CERTIFICATE").length).toBeGreaterThan(50);
  });

  it("prefers a CA supplied through the environment", () => {
    const resolved = resolveConnection(`${base}?sslmode=verify-full`, {
      DATABASE_SSL_CA: "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----",
    });
    expect(resolved.ssl).toEqual({
      rejectUnauthorized: true,
      ca: "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----",
    });
  });

  it("supports encrypted-but-unverified connections when asked explicitly", () => {
    expect(resolveConnection(`${base}?sslmode=no-verify`, {}).ssl).toEqual({
      rejectUnauthorized: false,
    });
  });

  it("keeps encoded credentials intact", () => {
    const resolved = resolveConnection(`${base}?sslmode=require`, {});
    expect(new URL(resolved.connectionString).password).toBe("p%40ss");
  });
});
