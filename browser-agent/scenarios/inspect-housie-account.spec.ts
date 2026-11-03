import { test, expect } from "../core";

test("inspect Housie Account record", async ({ page, housie }) => {
  await housie.login();
  await housie.openRecord("Housie_Account__c", "a00g500001D7iIrAAJ");
  await expect(page).toHaveURL(/Housie_Account__c\/a00g500001D7iIrAAJ\/view/);
  // Salesforce Lightning can keep <body> hidden while its shell bootstraps.
  // Wait for record-specific content instead of the document body.
  await page.locator("records-record-layout, lightning-record-view-form, .slds-page-header").first()
    .waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(2000);
  const visibleText = (await page.locator("body").innerText()).slice(0, 20000);
  housie.note("Visible record content:\n" + visibleText);
  await housie.screenshot("housie-account-record");
});
