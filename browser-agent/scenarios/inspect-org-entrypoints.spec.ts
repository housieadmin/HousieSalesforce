import { test, expect } from "../core";

async function navigateAndWait(page, url: string) {
  try {
    await page.goto(url, { waitUntil: "commit", timeout: 60000 });
  } catch (error) {
    // Lightning sometimes aborts the document navigation while handing control
    // to its SPA router. Treat that as recoverable only if the browser is still
    // on the requested Salesforce origin.
    if (!String(error).includes("ERR_ABORTED") ||
        new URL(page.url()).origin !== new URL(url).origin) throw error;
  }
  await page.locator("one-appnav, .slds-global-header_container").first()
    .waitFor({ state: "visible", timeout: 60000 });
}

test("inspect Salesforce admin entry points and Housie Experience Cloud shell", async ({ page, housie }) => {
  await housie.login();

  const flexipageUrl = new URL("/lightning/setup/FlexiPageList/home", page.url()).toString();
  await navigateAndWait(page, flexipageUrl);
  await page.waitForTimeout(1500);
  const flexipageText = (await page.locator("body").innerText()).slice(0, 18000);
  housie.note("Lightning Pages setup page content:\n" + flexipageText);
  await housie.screenshot("salesforce-lightning-pages");

  const communityUrl = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/";
  await page.goto(communityUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(error => {
    if (!String(error).includes("ERR_ABORTED")) throw error;
  });
  await page.locator("c-housie-app, c-housie-board-hub").first()
    .waitFor({ state: "attached", timeout: 60000 });
  const communityText = (await page.locator("body").innerText()).slice(0, 12000);
  housie.note("Housie Experience Cloud root content:\n" + communityText);
  await housie.screenshot("housie-community-root");

  expect(flexipageText.length, "Salesforce Lightning Pages setup should render").toBeGreaterThan(0);
  expect(communityText, "Housie Experience Cloud shell should render").toMatch(/HOUSIE|Welcome to Housie/i);
});
