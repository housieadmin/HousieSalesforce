import { spawnSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";

type DeployResponse = {
  cliStatus: number | null;
  response: Record<string, unknown>;
};

function parseCliJson(stdout: string, stderr: string): Record<string, unknown> | null {
  for (const raw of [stdout, stderr]) {
    const clean = raw.replace(/\u001b\[[0-9;]*m/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(clean.slice(start, end + 1));
      if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    } catch {
      // Try the other output stream; Salesforce CLI may write diagnostics to stderr.
    }
  }
  return null;
}

function safeText(value: unknown): string {
  return String(value ?? "")
    .replace(/[a-f0-9]{32}/gi, "[REDACTED_ID_OR_KEY]")
    .replace(/(access[_ -]?token|refresh[_ -]?token|client[_ -]?secret)\s*[:=]\s*[^\s,"]+/gi, "$1=[REDACTED]");
}

function runDeploy(args: string[], cwd: string, label: string): DeployResponse {
  const processResult = spawnSync("sf", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const stdout = String(processResult.stdout ?? "");
  const stderr = String(processResult.stderr ?? "");
  const response = parseCliJson(stdout, stderr);
  if (!response) {
    throw new Error(label + " returned no parseable JSON. "
      + safeText((stderr + "\n" + stdout).slice(-1800)));
  }
  return { cliStatus: processResult.status, response };
}

function deploymentSummary(run: DeployResponse): Record<string, unknown> {
  const result = (run.response.result ?? {}) as Record<string, unknown>;
  const details = (result.details ?? {}) as Record<string, unknown>;
  const tests = (details.runTestResult ?? {}) as Record<string, unknown>;
  const componentFailures = Array.isArray(details.componentFailures) ? details.componentFailures : [];
  const testFailures = Array.isArray(tests.failures) ? tests.failures : [];
  const coverageWarnings = Array.isArray(tests.codeCoverageWarnings) ? tests.codeCoverageWarnings : [];
  return {
    cliStatus: run.cliStatus,
    deployStatus: result.status ?? null,
    checkOnly: result.checkOnly ?? null,
    successfulComponents: Array.isArray(details.componentSuccesses)
      ? details.componentSuccesses.map((item: any) => ({ type: item.componentType || null, name: item.fullName || item.fileName || null }))
      : [],
    componentFailures: componentFailures.map((item: any) => ({
      type: item.componentType || null,
      name: item.fullName || item.fileName || null,
      problem: safeText(item.problem || item.message || "")
    })),
    tests: {
      run: tests.numTestsRun ?? null,
      completed: tests.numTestsCompleted ?? null,
      failures: tests.numFailures ?? null,
      failureDetails: testFailures.map((item: any) => ({
        className: item.name || null,
        method: item.methodName || null,
        message: safeText(item.message || ""),
        stackTrace: safeText(item.stackTrace || "")
      })),
      coverageWarnings: coverageWarnings.map((item: any) => ({ name: item.name || null, message: safeText(item.message || "") }))
    },
    errorMessage: safeText(run.response.message || "")
  };
}

function assertDeploySucceeded(run: DeployResponse, summary: Record<string, unknown>, label: string): void {
  expect(run.cliStatus, label + " must return Salesforce CLI exit status 0. Diagnostics: " + JSON.stringify(summary)).toBe(0);
  expect(summary.deployStatus, label + " must report Succeeded. Diagnostics: " + JSON.stringify(summary)).toBe("Succeeded");
  expect(summary.componentFailures, label + " must have zero component failures. Diagnostics: " + JSON.stringify(summary)).toEqual([]);
}

test("deploy only HousieGameTicketService to the authorized Developer Org", async ({ housie }) => {
  const sourceRoot = path.resolve(process.cwd(), "../.automation-source");
  const common = [
    "project", "deploy", "start",
    "--metadata", "ApexClass:HousieGameTicketService",
    "--target-org", "housie-browser-agent",
    "--test-level", "NoTestRun",
    "--wait", "60",
    "--json"
  ];

  const preview = runDeploy([...common, "--dry-run"], sourceRoot, "HousieGameTicketService dry-run");
  const previewSummary = deploymentSummary(preview);
  housie.note("HousieGameTicketService dry-run diagnostics: " + JSON.stringify(previewSummary));
  assertDeploySucceeded(preview, previewSummary, "HousieGameTicketService dry-run");
  housie.note("Narrow dry-run passed with NoTestRun; only ApexClass:HousieGameTicketService is selected. Apex tests are intentionally deferred to separate Milestone 1 acceptance runs.");

  const deployed = runDeploy(common, sourceRoot, "HousieGameTicketService deployment");
  const deployment = deploymentSummary(deployed);
  housie.note("HousieGameTicketService deployment diagnostics: " + JSON.stringify(deployment));
  assertDeploySucceeded(deployed, deployment, "HousieGameTicketService deployment");
  housie.note("Apex class deployment completed with NoTestRun. No other metadata was selected.");
});
