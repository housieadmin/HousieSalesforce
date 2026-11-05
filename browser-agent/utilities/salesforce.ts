import { execFileSync } from "node:child_process";
import path from "node:path";
import type { Page } from "@playwright/test";

/** Opens an authenticated Lightning route using the configured Salesforce CLI org alias. */
export async function openLightningTab(
  page: Page,
  lightningPath: string,
  targetOrg = "housie-browser-agent"
): Promise<void> {
  if (!lightningPath.startsWith("/lightning/")) {
    throw new Error("Expected a Lightning route beginning with /lightning/.");
  }
  const projectRoot = path.resolve(process.cwd(), "..");
  const output = execFileSync("sf", [
    "org", "open", "--url-only", "--path", lightningPath,
    "--target-org", targetOrg, "--json"
  ], { cwd: projectRoot, encoding: "utf8" });
  const clean = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
  const start = clean.indexOf("{");
  if (start < 0) throw new Error("Salesforce CLI did not return JSON for the frontdoor URL.");
  const result = JSON.parse(clean.slice(start));
  const url = result?.result?.url;
  if (typeof url !== "string" || !/^https:\/\//.test(url)) {
    throw new Error("Salesforce CLI did not return a valid frontdoor URL.");
  }
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(error => {
    if (!String(error).includes("ERR_ABORTED")) throw error;
  });
}

/** Redacts the account bearer key in the live DOM before assertions or artifacts. */
export async function redactAccountKey(page: Page): Promise<void> {
  const keyLine = page.getByText(/Account key:/);
  await keyLine.waitFor({ state: "visible", timeout: 60000 });
  await keyLine.evaluate(element => { element.textContent = "Account key: [REDACTED]"; });
}
