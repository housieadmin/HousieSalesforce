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
  } catch {
    throw new Error("Salesforce CLI query failed; query text and credentials were intentionally not copied into diagnostics.");
  }
  const parsed = JSON.parse(output);
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

  housie.note("Signup grant audit passed: one ACTIVE account, balances match SPEC, and four distinct committed-grant records exist. Bearer account key redacted; synthetic email and key omitted from artifacts.");
  await housie.screenshot("signup-grants-verified-redacted");
});
