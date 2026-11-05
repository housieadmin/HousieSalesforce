import { test, expect } from "../core";

test("create an active Housie test account through the admin UI", async ({ page, housie }) => {
  await housie.login();
  const adminTabUrl = new URL("/lightning/n/Housie_Account_Admin", page.url()).toString();
  await page.goto(adminTabUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(error => {
    if (!String(error).includes("ERR_ABORTED")) throw error;
  });

  await expect(page.getByText("Housie Account Administration", { exact: true }))
    .toBeVisible({ timeout: 60000 });

  const stamp = Date.now();
  const email = "housie.e2e.player." + stamp + "@housie.test";
  const displayName = "Housie E2E Player " + stamp;
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Display name", exact: true }).fill(displayName);
  await page.getByRole("button", { name: "Create account", exact: true }).click();

  // Account_Key__c is a bearer route credential. Mask it immediately after
  // submission, before assertions or failure screenshots can expose it.
  const keyLine = page.getByText(/Account key:/);
  await expect(keyLine).toBeVisible({ timeout: 60000 });
  await keyLine.evaluate(element => { element.textContent = "Account key: [REDACTED]"; });

  const createdLine = page.getByText("Created: " + displayName);
  await expect(createdLine, "Admin UI should create the Housie account record")
    .toBeVisible({ timeout: 30000 });

  const retrySetup = page.getByRole("button", { name: "Retry initial account setup", exact: true });
  if (await retrySetup.isVisible().catch(() => false)) {
    await retrySetup.click();
  }
  const statusLine = page.getByText("Status: ACTIVE", { exact: true });
  await expect(statusLine, "The account should become ACTIVE only after all four signup grants commit")
    .toBeVisible({ timeout: 60000 });

  housie.note("Created an active Housie test account through Housie Account Admin; test email=" + email + "; account key intentionally omitted.");
  await housie.screenshot("housie-test-account-created");
});
