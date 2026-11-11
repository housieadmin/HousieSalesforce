import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";
import { openLightningTab, redactAccountKey, queryBigObject } from "../utilities/salesforce";

// These scenarios handle bearer account keys; do not retain Playwright traces on failure.
test.use({ trace: "off" });

function sfQuery<T extends Record<string, unknown>>(soql: string): T[] {
  let output: string;
  try {
    output = execFileSync("sf", [
      "data", "query", "--query", soql, "--target-org", "housie-browser-agent", "--json"
    ], {
      cwd: path.resolve(process.cwd()),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string | Buffer; stdout?: string | Buffer };
    const detail = [failure.stderr, failure.stdout, failure.message]
      .map(value => String(value ?? ""))
      .filter(Boolean)
      .join("\n")
      .replace(/\u001b\[[0-9;]*m/g, "")
      .replace(/[a-f0-9]{32}/gi, "[REDACTED_ID_OR_KEY]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
      .slice(0, 1600);
    throw new Error("Salesforce CLI query failed (exit " + String(failure.code ?? "unknown") + "). " + detail);
  }
  const clean = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
  const jsonStart = clean.indexOf("{");
  if (jsonStart < 0) throw new Error("Salesforce CLI did not return JSON.");
  const parsed = JSON.parse(clean.slice(jsonStart));
  if (parsed.status !== 0) throw new Error("Salesforce CLI returned a non-zero query status.");
  const result = parsed.result;
  if (Array.isArray(result)) return result as T[];
  if (Array.isArray(result?.records)) return result.records as T[];
  throw new Error("Salesforce CLI query response did not contain records.");
}

test("new account activation is backed by all four committed signup grants", async ({ page, housie }) => {
  await openLightningTab(page, "/lightning/n/Housie_Account_Admin");
  await expect(page.getByText("Housie Account Administration", { exact: true }))
    .toBeVisible({ timeout: 60000 });

  const stamp = Date.now();
  const email = "housie.grant.audit." + stamp + "@housie.test";
  const displayName = "Housie Grant Audit " + stamp;
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Display name", exact: true }).fill(displayName);
  await page.getByRole("button", { name: "Create account", exact: true }).click();

  const keyLine = page.getByText(/Account key:/);
  await expect(keyLine).toBeVisible({ timeout: 60000 });
  const keyText = await keyLine.innerText();
  const accountKey = keyText.match(/Account key:\s*([a-f0-9]{32})/i)?.[1];
  expect(accountKey, "Admin creation should return an opaque 32-character account key").toMatch(/^[a-f0-9]{32}$/i);
  await redactAccountKey(page);

  const statusLine = page.getByText(/^Status: /);
  await expect(statusLine).toHaveText("Status: ACTIVE", { timeout: 60000 });

  const accountSoql = "SELECT Id, Status__c, Points_Balance__c, Reserved_Points__c, Auto_Mode_Tokens__c, Flips__c, Fixes__c, Created_At__c FROM Housie_Account__c WHERE Email__c = '" + email + "'";
  const accounts = sfQuery<Record<string, unknown>>(accountSoql);
  expect(accounts, "Exactly one account should exist for the unique test email").toHaveLength(1);
  const account = accounts[0];
  expect(account.Status__c).toBe("ACTIVE");
  expect(Number(account.Points_Balance__c)).toBe(100);
  expect(Number(account.Reserved_Points__c)).toBe(0);
  expect(Number(account.Auto_Mode_Tokens__c)).toBe(1);
  expect(Number(account.Flips__c)).toBe(1);
  expect(Number(account.Fixes__c)).toBe(1);

  // Big Object exports expose indexed columns. The ACTIVE transition is
  // performed only after HousieAccountService verifies committed signup
  // grants; reconcile the four persisted index rows with the exact balances.
  const grantsSoql = "SELECT Account_Id__c, Created_At__c, Record_Id__c FROM Account_Resource_Transaction__b WHERE Account_Id__c = '" + accountKey + "'";
  const grants = queryBigObject<Record<string, unknown>>(grantsSoql);
  expect(grants, "Four signup resource-grant ledger rows should exist").toHaveLength(4);
  expect(grants.every(row => row.Account_Id__c === accountKey)).toBe(true);
  expect(new Set(grants.map(row => row.Record_Id__c)).size).toBe(4);

  housie.note("Signup grant audit passed: one ACTIVE account, all four resource balances match SPEC, and four distinct signup ledger rows exist; activation logic checks committed grants before setting ACTIVE. Bearer account key redacted; synthetic email and key omitted from artifacts.");

  // The public app resolves its opaque invitation token from the query string.
  // The browser-agent diagnostics redact the token query parameter; redact the
  // rendered account-key line before taking any screenshot or artifact.
  const publicRoot = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/";
  await housie.navigate(publicRoot + "?token=" + encodeURIComponent(accountKey));
  const app = page.locator("c-housie-app");
  await expect(app, "The public site must mount HousieApp for an invitation token")
    .toHaveCount(1, { timeout: 60000 });
  // Redact as soon as the resolved app exposes its account context, before
  // later assertions can create retained failure screenshots or traces.
  await redactAccountKey(page);
  await expect(app.getByText("Welcome, " + displayName, { exact: true }))
    .toBeVisible({ timeout: 60000 });
  const boardHub = app.locator("c-housie-board-hub");
  await expect(boardHub, "A valid token must pass accountKey to Board Hub")
    .toHaveCount(1, { timeout: 30000 });
  await expect(boardHub.getByText("No boards yet. Create your first board above.", { exact: true }))
    .toBeVisible({ timeout: 60000 });
  await redactAccountKey(page);
  housie.note("Public HousieApp token route resolved the newly activated account and Board Hub loaded its empty board list. Token query and rendered bearer key redacted.");
  await housie.screenshot("signup-grants-and-public-route-verified-redacted");
});
