import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";

function runSf(args: string[]): string {
  try {
    return execFileSync("sf", args, {
      cwd: path.resolve(process.cwd()),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
  } catch {
    throw new Error("Salesforce CLI cleanup command failed; account keys and query text were not copied into diagnostics.");
  }
}

function parseJson(output: string) {
  const clean = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
  const start = clean.indexOf("{");
  if (start < 0) throw new Error("Salesforce CLI did not return JSON.");
  const parsed = JSON.parse(clean.slice(start));
  if (parsed.status !== 0) throw new Error("Salesforce CLI returned a non-zero status.");
  return parsed.result;
}

test("suspend synthetic accounts whose bearer key appeared in a failed test artifact", async ({ housie }) => {
  const names = [
    "M1 Two Human 1793865598827 owner",
    "M1 Two Human 1793865598827 member"
  ];
  let suspended = 0;
  for (const name of names) {
    const soql = "SELECT Id, Status__c FROM Housie_Account__c WHERE Display_Name__c = '" + name + "' LIMIT 2";
    const result = parseJson(runSf([
      "data", "query", "--query", soql, "--target-org", "housie-browser-agent", "--json"
    ]));
    const rows = Array.isArray(result?.records) ? result.records : [];
    expect(rows, "Synthetic account should be found for credential revocation").toHaveLength(1);
    const row = rows[0];
    if (row.Status__c !== "SUSPENDED") {
      parseJson(runSf([
        "data", "update", "record", "--sobject", "Housie_Account__c",
        "--record-id", String(row.Id), "--values", "Status__c=SUSPENDED",
        "--target-org", "housie-browser-agent", "--json"
      ]));
    }
    const verify = parseJson(runSf([
      "data", "query", "--query",
      "SELECT Status__c FROM Housie_Account__c WHERE Id = '" + row.Id + "' LIMIT 1",
      "--target-org", "housie-browser-agent", "--json"
    ]));
    const verifiedRows = Array.isArray(verify?.records) ? verify.records : [];
    expect(verifiedRows).toHaveLength(1);
    expect(verifiedRows[0].Status__c).toBe("SUSPENDED");
    suspended++;
  }
  housie.note("Suspended " + suspended + " synthetic test accounts after bearer-key exposure. Account keys and emails were not queried or recorded.");
});
