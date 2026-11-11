import { test, expect } from "../core";

const siteRoot = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/";

test("inspect the public HousieApp root route without changing site configuration", async ({ page, housie }) => {
  await housie.navigate(siteRoot);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(5000);

  const pageTitle = await page.title().catch(() => "");
  const bodyText = await page.locator("body").innerText().catch(() => "");
  const app = page.locator("c-housie-app");
  const appCount = await app.count();

  housie.note("Public Housie site root inspection: title=" + pageTitle
    + "; url=" + page.url()
    + "; c-housie-app count=" + appCount
    + "; body=" + bodyText.slice(0, 5000));
  await housie.screenshot("public-housie-root-route");

  expect(appCount, "The actual public site root must mount the HousieApp LWC; a Salesforce UnderConstruction/standard site page is not acceptance").toBe(1);
  await expect(app.getByText("Play together.", { exact: true })).toBeVisible({ timeout: 30000 });
});
