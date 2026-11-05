import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";

function toolingQuery<T extends Record<string, unknown>>(soql: string): T[] {
  const output = execFileSync("sf", [
    "data", "query", "--use-tooling-api", "--query", soql,
    "--target-org", "housie-browser-agent", "--json"
  ], { cwd: path.resolve(process.cwd(), ".."), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const clean = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
  const start = clean.indexOf("{");
  if (start < 0) throw new Error("Salesforce Tooling API query returned no JSON.");
  const parsed = JSON.parse(clean.slice(start));
  if (parsed.status !== 0) throw new Error("Salesforce Tooling API query returned a non-zero status.");
  const records = parsed.result?.records;
  if (!Array.isArray(records)) throw new Error("Salesforce Tooling API response did not contain records.");
  return records as T[];
}

test("inventory Developer Org Apex class and trigger coverage", async ({ housie }) => {
  const coverage = toolingQuery<Record<string, unknown>>(
    "SELECT ApexClassOrTriggerId, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate"
  );
  const classes = toolingQuery<Record<string, unknown>>("SELECT Id, Name FROM ApexClass");
  const triggers = toolingQuery<Record<string, unknown>>("SELECT Id, Name FROM ApexTrigger");
  const names = new Map<string, string>();
  for (const row of classes) names.set(String(row.Id), "ApexClass:" + String(row.Name));
  for (const row of triggers) names.set(String(row.Id), "ApexTrigger:" + String(row.Name));

  const rows = coverage.map(row => ({
    name: names.get(String(row.ApexClassOrTriggerId)) || "Unmapped Apex component",
    covered: Number(row.NumLinesCovered || 0),
    uncovered: Number(row.NumLinesUncovered || 0)
  })).sort((a, b) => b.uncovered - a.uncovered);
  const covered = rows.reduce((sum, row) => sum + row.covered, 0);
  const uncovered = rows.reduce((sum, row) => sum + row.uncovered, 0);
  const total = covered + uncovered;
  const percent = total ? Number((covered * 100 / total).toFixed(2)) : 0;

  expect(rows.length, "Coverage inventory must return Apex classes/triggers").toBeGreaterThan(0);
  housie.note("Developer Org Apex coverage inventory: " + JSON.stringify({
    components: rows.length,
    coveredLines: covered,
    uncoveredLines: uncovered,
    aggregateCoveragePercent: percent,
    lowestCoverageComponents: rows.slice(0, 30)
  }));
  housie.note("Read-only Tooling API coverage inventory; no org records or metadata were changed.");
});
