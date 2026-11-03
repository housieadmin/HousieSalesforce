import { test, expect } from "../core";

const existingAccountRecordId = "a00g500001D7iIrAAJ";

test("account administration completes signup grants without pending-work callout error", async ({ page, housie }) => {
  await housie.login();
  await housie.openRecord("Housie_Account__c", existingAccountRecordId);
  await page.locator("records-record-layout, lightning-record-view-form, .slds-page-header")
    .first().waitFor({ state: "visible", timeout: 60000 });

  const admin = page.locator("c-housie-account-admin");
  await expect(admin, "Housie Account Admin must be present on the configured account page")
    .toHaveCount(1, { timeout: 30000 });

  const unique = Date.now().toString();
  const email = `callout-e2e-${unique}@example.invalid`;
  await admin.locator("lightning-input[data-email] input").fill(email);
  await admin.locator("lightning-input:not([data-email]) input").last().fill("Callout E2E " + unique);
  await admin.getByRole("button", { name: "Create account" }).click();

  await expect(admin.getByText(/Status: ACTIVE/)).toBeVisible({ timeout: 90000 });
  await expect(admin.getByText(/pending uncommitted work|callout was unsuccessful/i)).toHaveCount(0);
  housie.note("Account signup created a new account and completed signup Big Object grants; UI displayed ACTIVE.");
  await housie.screenshot("account-signup-grants-success");
});

test("ticket purchase commits Big Object writes without pending-work callout error", async ({ page, housie }) => {
  await housie.login();
  await housie.openRecord("Housie_Account__c", existingAccountRecordId);
  await page.locator("records-record-layout, lightning-record-view-form, .slds-page-header")
    .first().waitFor({ state: "visible", timeout: 60000 });

  const recordText = await page.locator("body").innerText();
  const keyMatch = recordText.match(/Account Key\s*[:\n]\s*([a-f0-9]{32})/i);
  expect(keyMatch, "Existing account record must expose its Housie account key").not.toBeNull();
  const accountKey = keyMatch![1];

  await housie.navigate("/lightning/page/home?c__token=" + encodeURIComponent(accountKey));
  await expect(page.getByText("Your boards", { exact: true })).toBeVisible({ timeout: 60000 });

  const purchase = page.getByRole("button", { name: /Buy ticket/ }).first();
  await expect(purchase, "At least one waiting game must be available for ticket purchase")
    .toBeVisible({ timeout: 30000 });
  await purchase.click();

  await expect(page.getByText(/pending uncommitted work|callout was unsuccessful/i)).toHaveCount(0);
  await expect(page.getByText(/Ticket:/i)).toBeVisible({ timeout: 90000 });
  housie.note("Ticket purchase completed through the deployed Board Hub UI without the pending-work/callout error.");
  await housie.screenshot("ticket-purchase-success");
});
