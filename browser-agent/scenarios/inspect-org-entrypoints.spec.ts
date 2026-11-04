import { test, expect } from "../core";

test("inspect Salesforce admin pages and Housie Experience Cloud shell", async ({ page, housie }) => {
  await housie.login();

  const setupSearch = page.locator('input[placeholder="Search Setup"]').first();
  await setupSearch.waitFor({ state: "visible", timeout: 30000 });
  await setupSearch.fill("Lightning App Builder");
  await page.getByText("Lightning App Builder", { exact: true }).last().click();
  await page.getByText("Lightning Pages", { exact: true }).waitFor({ state: "visible", timeout: 60000 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1000);

  const pageRows = page.locator("tr").filter({ hasText: "House Account Admin" });
  const adminPageCount = await pageRows.count();
  const pageListText = (await page.locator("body").innerText()).slice(0, 18000);
  housie.note("Lightning App Builder page list; House Account Admin rows=" + adminPageCount + "\n" + pageListText);
  await housie.screenshot("salesforce-lightning-pages");

  expect(adminPageCount, "Expected at least one existing Housie Account Admin App Page").toBeGreaterThan(0);

  // Open the first matching page in Lightning App Builder to verify its actual component placement.
  await pageRows.first().getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByText(/Lightning App Builder/i).first().waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(4000);
  const editorText = (await page.locator("body").innerText()).slice(0, 20000);
  housie.note("Housie Account Admin page editor content:\n" + editorText);
  await housie.screenshot("housie-account-admin-page-editor");

  const communityUrl = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/";
  await page.goto(communityUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(error => {
    if (!String(error).includes("ERR_ABORTED")) throw error;
  });
  await page.locator("c-housie-app, c-housie-board-hub").first()
    .waitFor({ state: "attached", timeout: 60000 });
  const communityText = (await page.locator("body").innerText()).slice(0, 12000);
  housie.note("Housie Experience Cloud root content:\n" + communityText);
  await housie.screenshot("housie-community-root");

  expect(communityText, "Housie Experience Cloud shell should render").toMatch(/HOUSIE|Welcome to Housie/i);
});
