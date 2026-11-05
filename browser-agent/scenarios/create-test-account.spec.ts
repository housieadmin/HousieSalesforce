import { test, expect } from "../core";
import { openLightningTab, redactAccountKey } from "../utilities/salesforce";

// These scenarios handle bearer account keys; do not retain Playwright traces on failure.
test.use({ trace: "off" });

test("create an active Housie test account through the admin UI", async ({ page, housie }) => {
  await openLightningTab(page, "/lightning/n/Housie_Account_Admin");
  await expect(page.getByText("Housie Account Administration", { exact: true }))
    .toBeVisible({ timeout: 60000 });

  const stamp = Date.now();
  const email = "housie.e2e.player." + stamp + "@housie.test";
  const displayName = "Housie E2E Player " + stamp;
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Display name", exact: true }).fill(displayName);
  await page.getByRole("button", { name: "Create account", exact: true }).click();

  // Account_Key__c is a bearer route credential. Redact it before assertions/artifacts.
  await redactAccountKey(page);

  const statusLine = page.getByText(/^Status: /);
  await expect(statusLine, "Account creation must return an explicit lifecycle status")
    .toHaveText("Status: ACTIVE", { timeout: 60000 });

  const retrySetup = page.getByRole("button", { name: "Retry initial account setup", exact: true });
  if (await retrySetup.isVisible().catch(() => false)) {
    await retrySetup.click();
    await expect(statusLine, "Retry must complete all signup grants before activation")
      .toHaveText("Status: ACTIVE", { timeout: 60000 });
  }

  housie.note("Created active Housie test account through Housie Account Admin; email=" + email + "; bearer key redacted.");
  await housie.screenshot("housie-test-account-created");
});
