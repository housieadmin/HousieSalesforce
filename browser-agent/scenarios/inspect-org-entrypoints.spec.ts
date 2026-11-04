import { test, expect } from "../core";

async function waitForLightningShell(page) {
  await page.locator("one-appnav, .slds-global-header_container").first()
    .waitFor({ state: "visible", timeout: 60000 });
}

test("inspect Salesforce admin entry points and Housie Experience Cloud shell", async ({ page, housie }) => {
  await housie.login();
  await waitForLightningShell(page);

  // Use Setup navigation search rather than a guessed internal FlexiPage URL.
  const setupSearch = page.locator('input[placeholder="Search Setup"]').first();
  await setupSearch.waitFor({ state: "visible", timeout: 30000 });
  await setupSearch.fill("Lightning App Builder");
  const appBuilderResult = page.getByText("Lightning App Builder", { exact: true }).last();
  await appBuilderResult.waitFor({ state: "visible", timeout: 30000 });
  await appBuilderResult.click();
  await page.waitForTimeout(2500);
  const lightningPagesText = (await page.locator("body").innerText()).slice(0, 18000);
  housie.note("Lightning App Builder navigation result:\n" + lightningPagesText);
  await housie.screenshot("salesforce-lightning-app-builder");

  const communityUrl = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/";
  await page.goto(communityUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(error => {
    if (!String(error).includes("ERR_ABORTED")) throw error;
  });
  await page.locator("c-housie-app, c-housie-board-hub").first()
    .waitFor({ state: "attached", timeout: 60000 });
  const communityText = (await page.locator("body").innerText()).slice(0, 12000);
  housie.note("Housie Experience Cloud root content:\n" + communityText);
  await housie.screenshot("housie-community-root");

  expect(lightningPagesText.length, "Lightning App Builder should render a setup page").toBeGreaterThan(0);
  expect(communityText, "Housie Experience Cloud shell should render").toMatch(/HOUSIE|Welcome to Housie/i);
});
