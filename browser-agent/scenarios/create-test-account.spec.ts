import { test, expect } from "../core";
import { execFileSync } from "node:child_process";

test("create an active Housie test account through the admin UI", async ({ page, housie }) => {
  const projectRoot = process.cwd().replace(/\\/browser-agent$/, "");
  const openOutput = execFileSync("sf", [
    "org", "open", "--url-only", "--path", "/lightning/n/Housie_Account_Admin",
    "--target-org", "housie-browser-agent", "--json"
  ], { cwd: projectRoot, encoding: "utf8" });
  const cleanOutput = openOutput.replace(/\\u001b\\[[0-9;]*m/g, "").trim();
  const openResult = JSON.parse(cleanOutput.slice(cleanOutput.indexOf("{")));
  const frontdoorUrl = openResult?.result?.url;
  expect(frontdoorUrl, "Salesforce should provide a frontdoor URL for the admin tab").toMatch(/^https:\\/\\//);
  await page.goto(frontdoorUrl, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(error => {
    if (!String(error).includes("ERR_ABORTED")) throw error;
  });
  await page.waitForTimeout(2000);

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
