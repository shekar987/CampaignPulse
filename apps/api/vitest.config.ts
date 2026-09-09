import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests need a database; the URL comes from apps/api/.env (DATABASE_URL_TEST) or the
// CI environment. Unit tests run without it.
loadDotenv({ path: fileURLToPath(new URL("./.env", import.meta.url)), quiet: true });

export default defineConfig({
  test: {
    name: "api",
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/setup/global-setup.ts"],
    // Integration test files share one database and reset it between tests, so files must not
    // run concurrently with each other.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      ...(process.env.DATABASE_URL_TEST
        ? { DATABASE_URL_TEST: process.env.DATABASE_URL_TEST }
        : {}),
    },
  },
});
