import { test, expect } from "../core";

test("inspect Salesforce admin pages and Housie Experience Cloud shell", async ({ page, housie }) => {
  await housie.login();

  const userInterface = page.getByRole("treeitem", { name: "User Interface" });
  const expand = userInterface.getByRole("button", { name: "Expand" });
  if (await expand.count()) await expand.click();
  const appBuilderLink = userInterface.getByRole("link", { name: "Lightning App Builder", exact: true });
  await appBuilderLink.waitFor({ state: "visible", timeout: 30000 });
  await appBuilderLink.click();
  await page.getByText("Lightning Pages", { exact: true }).waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(1500);

  const pageRows = page.locator("tr").filter({ hasText: "House Account Admin" });
  const adminPageCount = await pageRows.count();
  const pageListText = (await page.locator("body").innerText()).slice(0, 18000);
  housie.note("Lightning App Builder page list; House Account Admin rows=" + adminPageCount + "\n" + pageListText);
  await housie.screenshot("salesforce-lightning-pages");
  expect(adminPageCount, "Expected at least one existing Housie Account Admin App Page").toBeGreaterThan(0);

  await pageRows.first().getByRole("link", { name: "Edit", exact: true }).click();
  await page.waitForTimeout(5000);
  const editorText = (await page.locator("body").innerText()).slice(0, 20000);
  housie.note("Housie Account Admin page editor content:\n" + editorText);
  await housie.screenshot("housie-account-admin-page-editor");

  const adminTabUrl = new URL("/lightning/n/Housie_Account_Admin", page.url()).toString();
  await page.goto(adminTabUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(error => {
    if (!String(error).includes("ERR_ABORTED")) throw error;
  });
  await expect(page.getByText("Housie Account Administration", { exact: true }))
    .toBeVisible({ timeout: 60000 });
  housie.note("Housie Account Admin tab renders the account creation component.");
  await housie.screenshot("housie-account-admin-tab");

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
