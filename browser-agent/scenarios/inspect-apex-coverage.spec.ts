import { spawnSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";

function runJson(args: string[]): Record<string, unknown> {
  const result = spawnSync("sf", args, { cwd: path.resolve(process.cwd(), ".."), encoding: "utf8", maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  const streams = [String(result.stdout ?? ""), String(result.stderr ?? "")];
  for (const raw of streams) {
    const clean = raw.replace(/\u001b\[[0-9;]*m/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(clean.slice(start, end + 1));
      if (parsed && typeof parsed === "object") return { cliStatus: result.status, ...parsed };
    } catch { /* Try the other stream. */ }
  }
  throw new Error("Salesforce CLI returned no parseable JSON: " + (streams.join("\n").slice(-1600)));
}

test("refresh and inventory Developer Org Apex class and trigger coverage", async ({ housie }) => {
  const testRun = runJson(["apex", "run", "test", "--target-org", "housie-browser-agent", "--test-level", "RunLocalTests", "--code-coverage", "--result-format", "json", "--wait", "60", "--json"]);
  const testResult = (testRun.result ?? {}) as Record<string, unknown>;
  const summary = (testResult.summary ?? testResult) as Record<string, unknown>;
  const testDiagnostics = {
    cliStatus: testRun.cliStatus,
    outcome: summary.outcome ?? summary.status ?? null,
    testsRan: summary.testsRan ?? summary.numTestsRun ?? null,
    passing: summary.passing ?? null,
    failing: summary.failing ?? summary.numFailures ?? null,
    skipped: summary.skipped ?? null,
    testRunId: summary.testRunId ?? null,
    coverageWarnings: summary.codeCoverageWarnings ?? null
  };
  housie.note("RunLocalTests with code coverage: " + JSON.stringify(testDiagnostics));
  expect(testRun.cliStatus, "RunLocalTests must complete successfully").toBe(0);
  expect(Number(testDiagnostics.failing ?? 0), "RunLocalTests must have zero failures").toBe(0);
  expect(Number(testDiagnostics.testsRan ?? 0), "RunLocalTests must execute tests").toBeGreaterThan(0);

  const coverage = runJson(["data", "query", "--use-tooling-api", "--query", "SELECT ApexClassOrTriggerId, NumLinesCovered, NumLinesUncovered FROM ApexCodeCoverageAggregate", "--target-org", "housie-browser-agent", "--json"]);
  const coverageResult = (coverage.result ?? {}) as Record<string, unknown>;
  const coverageRows = Array.isArray(coverageResult.records) ? coverageResult.records as Record<string, unknown>[] : [];
  const classes = runJson(["data", "query", "--use-tooling-api", "--query", "SELECT Id, Name FROM ApexClass", "--target-org", "housie-browser-agent", "--json"]);
  const classRows = ((classes.result ?? {}) as Record<string, unknown>).records as Record<string, unknown>[];
  const triggers = runJson(["data", "query", "--use-tooling-api", "--query", "SELECT Id, Name FROM ApexTrigger", "--target-org", "housie-browser-agent", "--json"]);
  const triggerRows = ((triggers.result ?? {}) as Record<string, unknown>).records as Record<string, unknown>[];
  const names = new Map<string, string>();
  for (const row of classRows) names.set(String(row.Id), "ApexClass:" + String(row.Name));
  for (const row of triggerRows) names.set(String(row.Id), "ApexTrigger:" + String(row.Name));
  const rows = coverageRows.map(row => ({
    name: names.get(String(row.ApexClassOrTriggerId)) || "Unmapped Apex component",
    covered: Number(row.NumLinesCovered || 0),
    uncovered: Number(row.NumLinesUncovered || 0)
  })).sort((a, b) => b.uncovered - a.uncovered);
  const covered = rows.reduce((sum, row) => sum + row.covered, 0);
  const uncovered = rows.reduce((sum, row) => sum + row.uncovered, 0);
  const total = covered + uncovered;
  const percent = total ? Number((covered * 100 / total).toFixed(2)) : 0;
  expect(rows.length, "Coverage inventory must return Apex classes/triggers").toBeGreaterThan(0);
  housie.note("Post-test Developer Org coverage inventory: " + JSON.stringify({
    components: rows.length, coveredLines: covered, uncoveredLines: uncovered,
    aggregateCoveragePercent: percent, lowestCoverageComponents: rows.slice(0, 30)
  }));
  housie.note("Tests and Tooling API coverage inventory are read-only; no business records or metadata were changed.");
});
