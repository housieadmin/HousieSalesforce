import { test, expect } from "../core";
import { openLightningTab } from "../utilities/salesforce";

test("open the configured Housie Account Admin tab", async ({ page, housie }) => {
  await openLightningTab(page, "/lightning/n/Housie_Account_Admin");

  const component = page.locator("c-housie-account-admin");
  await expect(component, "The Housie Account Admin tab should mount the LWC")
    .toHaveCount(1, { timeout: 60000 });
  await expect(page.getByText("Housie Account Administration", { exact: true }))
    .toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("textbox", { name: "Email", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account", exact: true })).toBeVisible();

  housie.note("Housie_Account_Admin custom tab opens and exposes the account creation form.");
  await housie.screenshot("housie-account-admin-form");
});
