import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Automated accessibility audit of every screen with axe-core. It cannot prove a page is
 * accessible, but it catches the common regressions: missing names, poor contrast, broken
 * landmarks and form labelling.
 */

async function firstId(page: Page, query: string, pick: (data: never) => string): Promise<string> {
  const response = await page.request.post("http://localhost:4000/graphql", {
    data: { query },
  });
  const body = (await response.json()) as { data: never };
  return pick(body.data);
}

async function audit(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Let skeletons resolve before scanning.
  await expect(page.getByRole("status", { busy: true })).toHaveCount(0, { timeout: 20_000 });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`),
  ).toEqual([]);
}

test.describe("accessibility", () => {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test("overview", async ({ page }) => audit(page, "/"));
      test("campaigns", async ({ page }) => audit(page, "/campaigns"));
      test("create campaign", async ({ page }) => audit(page, "/campaigns/new"));
      test("campaign detail", async ({ page }) => {
        const id = await firstId(
          page,
          '{ campaigns(filter:{search:"Summer Drinks"}) { items { id } } }',
          (data: { campaigns: { items: { id: string }[] } }) => data.campaigns.items[0]!.id,
        );
        await audit(page, `/campaigns/${id}`);
      });
      test("incidents", async ({ page }) => audit(page, "/incidents"));
      test("incident detail", async ({ page }) => {
        const id = await firstId(
          page,
          "{ incidents(pageSize: 1) { items { id } } }",
          (data: { incidents: { items: { id: string }[] } }) => data.incidents.items[0]!.id,
        );
        await audit(page, `/incidents/${id}`);
      });
      test("dead letters", async ({ page }) => audit(page, "/dead-letters"));
    });
  }
});
