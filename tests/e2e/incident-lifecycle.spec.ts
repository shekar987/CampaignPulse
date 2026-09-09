import { expect, test, type Page } from "@playwright/test";

/**
 * The complete operator journey from the product brief: create a campaign, simulate a critical
 * failure, watch an incident open automatically, acknowledge it, retry the failed deliveries,
 * and resolve it. Runs against the real API, event bus and database.
 */

async function createCampaign(page: Page, name: string, channels: string[]) {
  await page.goto("/campaigns/new");
  await page.getByLabel("Campaign name").fill(name);
  await page.getByLabel("Advertiser").fill("E2E Advertiser");
  for (const channel of channels) {
    // The checkbox's accessible name is its label plus its description; substring match.
    await page.getByRole("checkbox", { name: channel }).check();
  }
  await page.getByRole("button", { name: /create campaign/i }).click();
  await expect(page).toHaveURL(/\/campaigns\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

async function runScenario(page: Page, scenario: string) {
  await page.getByLabel("Scenario").selectOption(scenario);
  await page.getByRole("button", { name: /run simulation/i }).click();
  await expect(page.getByRole("status").filter({ hasText: /started at/ })).toBeVisible();
}

test("critical failure opens an incident that can be acknowledged, retried and resolved", async ({
  page,
}) => {
  const name = `E2E Critical ${Date.now()}`;
  await createCampaign(page, name, ["SmartShop"]);

  await runScenario(page, "CRITICAL");

  // Health recalculates as workers drain the queue; the page polls every few seconds.
  const channelCard = page
    .getByRole("list", { name: "Channel delivery health" })
    .getByRole("listitem");
  await expect(channelCard.getByText("Critical", { exact: true })).toBeVisible({ timeout: 90_000 });

  const incidentLink = page.getByRole("link", { name: "SmartShop delivery failures" });
  await expect(incidentLink).toBeVisible({ timeout: 60_000 });
  await incidentLink.click();

  await expect(
    page.getByRole("heading", { level: 1, name: "SmartShop delivery failures" }),
  ).toBeVisible();
  await expect(page.getByText("Investigating", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Acknowledge" }).click();
  await expect(page.getByText("Acknowledged", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: /retry failed deliveries/i }).click();
  await expect(page.getByRole("status").filter({ hasText: /re-requested|to retry/ })).toBeVisible();

  await page.getByRole("button", { name: "Resolve", exact: true }).click();
  await page.getByLabel(/resolution note/i).fill("Placement service recovered");
  await page.getByRole("button", { name: /confirm resolve/i }).click();
  await expect(page.getByText("Resolved", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Placement service recovered")).toBeVisible();

  // The incident timeline is on the campaign's event history.
  await page.getByRole("link", { name: "All incidents" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Incidents" })).toBeVisible();
});

test("a delivery that exhausts its retries is dead-lettered and can be replayed", async ({
  page,
}) => {
  const name = `E2E Dead letter ${Date.now()}`;
  await createCampaign(page, name, ["Website"]);

  await runScenario(page, "DEAD_LETTER");

  const dlq = page.getByRole("region", { name: "Dead-letter queue" });
  await expect(dlq.getByText("Retries exhausted")).toBeVisible({ timeout: 90_000 });
  await expect(dlq.getByRole("table").getByText("Awaiting replay")).toBeVisible();

  await dlq.getByRole("button", { name: /retry all failed deliveries/i }).click();
  await expect(dlq.getByRole("status")).toContainText("1 delivery re-requested");

  await dlq.getByLabel("Show").selectOption("REPLAYED");
  await expect(dlq.getByRole("table").getByText("Replayed", { exact: true })).toBeVisible();
  await expect(dlq.getByText(/replayed as .*-r1/)).toBeVisible();

  // The timeline shows the full retry chain for the original delivery.
  await page
    .getByRole("link", { name: /-0001$/ })
    .first()
    .click();
  await expect(page.getByText("Final failure (dead-letter queue)")).toBeVisible({
    timeout: 30_000,
  });
});
