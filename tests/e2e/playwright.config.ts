import { defineConfig, devices } from "@playwright/test";

const isCI = Boolean(process.env.CI);

/**
 * End-to-end tests drive the real stack: the Vite dev server proxies /graphql to the API, which
 * hosts the in-process event bus, against a PostgreSQL database (DATABASE_URL in apps/api/.env
 * or the environment). Both servers are started here unless they are already running.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  outputDir: "../../.playwright/results",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev:api",
      // Port-based readiness: the GraphQL endpoint rejects the HEAD probe a URL check sends.
      port: 4000,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      cwd: "../..",
    },
    {
      command: "npm run dev:web",
      port: 5173,
      reuseExistingServer: !isCI,
      timeout: 120_000,
      cwd: "../..",
    },
  ],
});
