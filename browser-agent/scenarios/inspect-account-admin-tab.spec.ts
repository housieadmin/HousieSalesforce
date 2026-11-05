import { test, expect } from "../core";
import { execFileSync } from "node:child_process";

test("open the configured Housie Account Admin tab", async ({ page, housie }) => {
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
