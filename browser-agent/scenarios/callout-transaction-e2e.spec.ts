import { test, expect } from "../core";

const site = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s";
const superAdminUrl = site + "/housie-account/a00g500001D72UwAAJ/housie-super-admin";
const playerUrl = site + "/housie-account/a00g500001D7iIrAAJ/housie-test-user-2";

test("public super-admin account creation completes signup grants", async ({ page, housie }) => {
  await housie.navigate(superAdminUrl);
  const admin = page.locator("c-housie-account-admin");
  await expect(admin, "Public super-admin page should render Account Administration").toHaveCount(1, { timeout: 60000 });

  const unique = Date.now().toString();
  await admin.locator("lightning-input[data-email] input").fill("callout-e2e-" + unique + "@example.com");
  await admin.locator("lightning-input:not([data-email]) input").fill("Callout E2E " + unique);
  await admin.getByRole("button", { name: "Create account" }).click();

  await expect(admin.getByText(/Status:\s*ACTIVE/i)).toBeVisible({ timeout: 90000 });
  await expect(admin.getByText(/pending uncommitted work|callout was unsuccessful/i)).toHaveCount(0);
  housie.note("Public super-admin signup completed and displayed ACTIVE.");
  await housie.screenshot("public-super-admin-signup-success");
});

test("public test-user account completes ticket purchase", async ({ page, housie }) => {
  await housie.navigate(playerUrl);
  const hub = page.locator("c-housie-board-hub");
  await expect(hub, "Public account page should render Board Hub").toHaveCount(1, { timeout: 60000 });
  await expect(hub.getByText("Your boards", { exact: true })).toBeVisible({ timeout: 60000 });

  const purchase = hub.getByRole("button", { name: /Buy ticket/ }).first();
  await expect(purchase, "A waiting game must be available for this account").toBeVisible({ timeout: 30000 });
  await purchase.click();

  await expect(hub.getByText(/pending uncommitted work|callout was unsuccessful/i)).toHaveCount(0);
  await expect(hub.getByText(/Ticket:/i)).toBeVisible({ timeout: 90000 });
  housie.note("Public ticket purchase returned a ticket result without pending-work callout error.");
  await housie.screenshot("public-ticket-purchase-success");
});
