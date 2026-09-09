import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

/**
 * Captures the README screenshots from the running local stack (seeded data).
 * Run: npx tsx tests/e2e/screenshots.ts
 */
const outDir = fileURLToPath(new URL("../../docs/screenshots/", import.meta.url));
const base = "http://localhost:5173";

async function graphql<T>(query: string): Promise<T> {
  const response = await fetch("http://localhost:4000/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return ((await response.json()) as { data: T }).data;
}

await mkdir(outDir, { recursive: true });
const campaigns = await graphql<{ campaigns: { items: { id: string }[] } }>(
  '{ campaigns(filter:{search:"Summer Drinks"}) { items { id } } }',
);
const incidents = await graphql<{ incidents: { items: { id: string }[] } }>(
  "{ incidents(filter:{severity:CRITICAL}, pageSize: 1) { items { id } } }",
);
const campaignId = campaigns.campaigns.items[0]!.id;
const incidentId = incidents.incidents.items[0]!.id;

const shots: { name: string; path: string; fullPage?: boolean; mobile?: boolean }[] = [
  { name: "overview", path: "/" },
  { name: "campaigns", path: "/campaigns" },
  { name: "campaign-detail", path: `/campaigns/${campaignId}`, fullPage: true },
  { name: "incidents", path: "/incidents" },
  { name: "incident-detail", path: `/incidents/${incidentId}` },
  { name: "dead-letters", path: "/dead-letters" },
  { name: "overview-mobile", path: "/", mobile: true },
  { name: "campaign-detail-mobile", path: `/campaigns/${campaignId}`, mobile: true },
];

const browser = await chromium.launch();
for (const shot of shots) {
  const context = await browser.newContext({
    viewport: shot.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: shot.mobile ? 2 : 1,
    colorScheme: "light",
  });
  const page = await context.newPage();
  await page.goto(`${base}${shot.path}`);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[aria-busy="true"]').length === 0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${outDir}${shot.name}.png`, fullPage: shot.fullPage ?? false });
  process.stdout.write(`captured ${shot.name}.png
`);
  await context.close();
}
await browser.close();
