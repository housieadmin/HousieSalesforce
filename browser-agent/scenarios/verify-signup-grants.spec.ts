import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";
import { openLightningTab, redactAccountKey } from "../utilities/salesforce";

function sfQuery<T extends Record<string, unknown>>(soql: string): T[] {
  let output: string;
  try {
    output = execFileSync("sf", [
      "data", "query", "--query", soql, "--target-org", "housie-browser-agent", "--json"
    ], {
      cwd: path.resolve(process.cwd(), ".."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string | Buffer; stdout?: string | Buffer };
    const detail = String(failure.stderr ?? failure.stdout ?? "")
      .replace(/\u001b\[[0-9;]*m/g, "")
      .replace(/[a-f0-9]{32}/gi, "[REDACTED_ID_OR_KEY]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
      .slice(0, 1200);
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

  const accountSoql = "SELECT Id, Status__c, Points_Balance__c, Reserved_Points__c, Auto_Mode_Tokens__c, Flips__c, Fixes__c, Created_At__c FROM Housie_Account__c WHERE Email__c = '" + email + "' LIMIT 2";
  const accounts = sfQuery<Record<string, unknown>>(accountSoql);
  expect(accounts, "Exactly one account should exist for the unique test email").toHaveLength(1);
  const account = accounts[0];
  expect(account.Status__c).toBe("ACTIVE");
  expect(Number(account.Points_Balance__c)).toBe(100);
  expect(Number(account.Reserved_Points__c)).toBe(0);
  expect(Number(account.Auto_Mode_Tokens__c)).toBe(1);
  expect(Number(account.Flips__c)).toBe(1);
  expect(Number(account.Fixes__c)).toBe(1);

  const grantsSoql = "SELECT Record_Id__c, Resource_Type__c, Transaction_Type__c, Quantity__c, Source_Type__c, Source_Id__c, Operation_Id__c FROM Account_Resource_Transaction__b WHERE Account_Id__c = '" + accountKey + "' LIMIT 10";
  const grants = sfQuery<Record<string, unknown>>(grantsSoql);
  const expected = new Map([["POINTS", 100], ["AUTO_MODE_TOKEN", 1], ["FLIP", 1], ["FIX", 1]]);
  const signupGrants = grants.filter(row => row.Transaction_Type__c === "GRANT" && row.Source_Type__c === "SIGNUP");
  expect(signupGrants, "All four signup grant ledger records must exist").toHaveLength(4);
  for (const [resource, quantity] of expected) {
    const rows = signupGrants.filter(row => row.Resource_Type__c === resource);
    expect(rows, "Exactly one " + resource + " signup grant should exist").toHaveLength(1);
    expect(Number(rows[0].Quantity__c)).toBe(quantity);
    expect(rows[0].Source_Id__c).toBe(accountKey);
    expect(String(rows[0].Operation_Id__c || "")).toMatch(/^[a-f0-9]{32}$/i);
  }
  const grantOperationIds = [...new Set(signupGrants.map(row => String(row.Operation_Id__c)))];
  expect(grantOperationIds).toHaveLength(1);
  const grantJournal = sfQuery<Record<string, unknown>>(
    "SELECT Status__c FROM Operation_Journal__b WHERE Operation_Id__c = '" + grantOperationIds[0] + "' LIMIT 2"
  );
  expect(grantJournal.some(row => row.Status__c === "COMMITTED"),
    "Signup grant operation must have a COMMITTED journal marker").toBe(true);

  housie.note("Signup grant audit passed: one ACTIVE account, balances match SPEC, and four distinct committed-grant records exist. Bearer account key redacted; synthetic email and key omitted from artifacts.");

  // The public app resolves its opaque invitation token from the query string.
  // The browser-agent diagnostics redact the token query parameter; redact the
  // rendered account-key line before taking any screenshot or artifact.
  const publicRoot = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/";
  await housie.navigate(publicRoot + "?token=" + encodeURIComponent(accountKey));
  const app = page.locator("c-housie-app");
  await expect(app, "The public site must mount HousieApp for an invitation token")
    .toHaveCount(1, { timeout: 60000 });
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
