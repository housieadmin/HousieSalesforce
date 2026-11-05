import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";

function sfJson(args: string[]) {
  try {
    const output = execFileSync("sf", args, {
      cwd: path.resolve(process.cwd(), ".."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const clean = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
    const start = clean.indexOf("{");
    if (start < 0) throw new Error("Salesforce CLI did not return JSON.");
    const parsed = JSON.parse(clean.slice(start));
    if (parsed.status !== 0) throw new Error("Salesforce CLI returned a non-zero status.");
    return parsed.result;
  } catch {
    throw new Error("Synthetic-account cleanup command failed; no account keys or emails were captured.");
  }
}

test("suspend Milestone 1 synthetic browser-test accounts", async ({ housie }) => {
  const soql = "SELECT Id, Display_Name__c, Status__c FROM Housie_Account__c WHERE " +
    "(Display_Name__c LIKE 'M1 Two Human %' OR Display_Name__c LIKE 'Housie Grant Audit %' OR Display_Name__c LIKE 'M1 Purchase %')";
  const result = sfJson([
    "data", "query", "--query", soql, "--target-org", "housie-browser-agent", "--json"
  ]);
  const rows = Array.isArray(result?.records) ? result.records : [];
  let suspended = 0;
  for (const row of rows) {
    if (row.Status__c !== "SUSPENDED") {
      sfJson([
        "data", "update", "record", "--sobject", "Housie_Account__c",
        "--record-id", String(row.Id), "--values", "Status__c=SUSPENDED",
        "--target-org", "housie-browser-agent", "--json"
      ]);
    }
    const verify = sfJson([
      "data", "query", "--query",
      "SELECT Status__c FROM Housie_Account__c WHERE Id = '" + row.Id + "'",
      "--target-org", "housie-browser-agent", "--json"
    ]);
    const verified = Array.isArray(verify?.records) ? verify.records : [];
    expect(verified).toHaveLength(1);
    expect(verified[0].Status__c).toBe("SUSPENDED");
    suspended++;
  }
  housie.note("Verified " + suspended + " Milestone 1 synthetic browser-test accounts are SUSPENDED. No account keys or emails were queried or retained.");
});
