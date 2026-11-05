import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";

function describeObject(name: string) {
  const output = execFileSync("sf", [
    "sobject", "describe", "--sobject", name, "--target-org", "housie-browser-agent", "--json"
  ], { cwd: path.resolve(process.cwd(), ".."), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const clean = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
  const start = clean.indexOf("{");
  if (start < 0) throw new Error("Salesforce CLI describe did not return JSON.");
  const parsed = JSON.parse(clean.slice(start));
  if (parsed.status !== 0) throw new Error("Salesforce CLI describe failed.");
  return parsed.result;
}

test("inspect live Developer Org Big Object field API names", async ({ housie }) => {
  const names = ["Board_Member__b", "Account_Resource_Transaction__b", "Wallet_Hold__b", "Game_Participant__b"];
  const result: Record<string, string[]> = {};
  for (const name of names) {
    const described = describeObject(name);
    result[name] = (described.fields || []).map((field: { name: string }) => field.name).sort();
  }
  housie.note(JSON.stringify(result, null, 2));
  expect(result.Board_Member__b).toContain("Board_Role__c");
  expect(result.Account_Resource_Transaction__b).toContain("Resource_Type__c");
});
