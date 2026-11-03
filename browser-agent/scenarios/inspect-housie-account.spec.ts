import { test, expect } from "../core";

test("inspect Housie Account record", async ({ page, housie }) => {
  await housie.login();
  await housie.openRecord("Housie_Account__c", "a00g500001D7iIrAAJ");
  await expect(page).toHaveURL(/Housie_Account__c\/a00g500001D7iIrAAJ\/view/);
  await page.locator("body").waitFor({ state: "visible" });
  await page.waitForTimeout(5000);
  const visibleText = (await page.locator("body").innerText()).slice(0, 20000);
  housie.note("Visible record content:\n" + visibleText);
  await housie.screenshot("housie-account-record");
});
