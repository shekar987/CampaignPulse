import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * Applies migrations to the integration-test database once per test run. Skipped entirely when
 * DATABASE_URL_TEST is not set, so unit tests never need PostgreSQL.
 */
export default function globalSetup(): void {
  const url = process.env.DATABASE_URL_TEST;
  if (!url) {
    console.info("DATABASE_URL_TEST not set: database integration tests will be skipped");
    return;
  }
  execSync("npx prisma migrate deploy", {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
