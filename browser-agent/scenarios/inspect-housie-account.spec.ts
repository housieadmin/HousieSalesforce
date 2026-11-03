import { test, expect } from "../core";

test("inspect Housie Account record", async ({ page, housie }) => {
  await housie.login();
  const recordUrl = new URL("/lightning/r/Housie_Account__c/a00g500001D5PSVAA3/view", page.url()).toString();
  // Lightning may cancel a full-document navigation while its SPA router takes over.
  // Treat only ERR_ABORTED as a handoff; still require the record route and content below.
  try {
    await page.goto(recordUrl, { waitUntil: "commit" });
  } catch (error) {
    if (!String(error).includes("ERR_ABORTED")) throw error;
    housie.note("Lightning cancelled the document navigation; current URL: " + page.url());
  }
  await expect(page).toHaveURL(/Housie_Account__c\/a00g500001D5PSVAA3\/view/, { timeout: 15000 });
  // Salesforce Lightning can keep <body> hidden while its shell bootstraps.
  // Wait for record-specific content instead of the document body.
  await page.locator("records-record-layout, lightning-record-view-form, .slds-page-header").first()
    .waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(2000);
  const visibleText = (await page.locator("body").innerText()).slice(0, 20000);
  housie.note("Visible record content:\n" + visibleText);
  await housie.screenshot("housie-account-record");
});
