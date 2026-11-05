import { spawnSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";

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
      // Try the other stream; Salesforce CLI may write diagnostics to stderr.
    }
  }
  return null;
}

function safeText(value: unknown): string {
  return String(value ?? "")
    .replace(/[a-f0-9]{32}/gi, "[REDACTED_ID_OR_KEY]")
    .replace(/(access[_ -]?token|refresh[_ -]?token|client[_ -]?secret)\s*[:=]\s*[^\s,"]+/gi, "$1=[REDACTED]");
}

function runDeploy(args: string[], cwd: string, label: string) {
  const result = spawnSync("sf", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const response = parseCliJson(String(result.stdout ?? ""), String(result.stderr ?? ""));
  if (!response) {
    throw new Error(label + " returned no parseable JSON. " +
      safeText((String(result.stderr ?? "") + "\n" + String(result.stdout ?? "")).slice(-1800)));
  }
  const deployment = (response.result ?? {}) as Record<string, unknown>;
  const details = (deployment.details ?? {}) as Record<string, unknown>;
  const summary = {
    cliStatus: result.status,
    deployStatus: deployment.status ?? null,
    checkOnly: deployment.checkOnly ?? null,
    successfulComponents: Array.isArray(details.componentSuccesses)
      ? details.componentSuccesses.map((item: any) => ({
          type: item.componentType || null,
          name: item.fullName || item.fileName || null
        }))
      : [],
    componentFailures: Array.isArray(details.componentFailures)
      ? details.componentFailures.map((item: any) => ({
          type: item.componentType || null,
          name: item.fullName || item.fileName || null,
          problem: safeText(item.problem || item.message || "")
        }))
      : [],
    errorMessage: safeText(response.message || "")
  };
  return { summary, rawStatus: result.status };
}

function assertSucceeded(result: ReturnType<typeof runDeploy>, label: string) {
  expect(result.rawStatus, label + " must return CLI status 0. " + JSON.stringify(result.summary)).toBe(0);
  expect(result.summary.deployStatus, label + " must report Succeeded. " + JSON.stringify(result.summary)).toBe("Succeeded");
  expect(result.summary.componentFailures, label + " must have zero component failures. " + JSON.stringify(result.summary)).toEqual([]);
  expect(result.summary.successfulComponents, label + " must include HousieBoardService. " + JSON.stringify(result.summary))
    .toEqual(expect.arrayContaining([expect.objectContaining({ type: "ApexClass", name: "HousieBoardService" })]));
}

test("deploy only HousieBoardService with the existing NoTestRun deployment mode", async ({ housie }) => {
  const sourceRoot = path.resolve(process.cwd(), "../../.browser-agent-source");
  const common = [
    "project", "deploy", "start",
    "--metadata", "ApexClass:HousieBoardService",
    "--target-org", "housie-browser-agent",
    "--test-level", "NoTestRun",
    "--wait", "60",
    "--json"
  ];
  const preview = runDeploy([...common, "--dry-run"], sourceRoot, "HousieBoardService dry-run");
  housie.note("HousieBoardService NoTestRun dry-run: " + JSON.stringify(preview.summary));
  assertSucceeded(preview, "HousieBoardService dry-run");
  const deployed = runDeploy(common, sourceRoot, "HousieBoardService deployment");
  housie.note("HousieBoardService NoTestRun deployment: " + JSON.stringify(deployed.summary));
  assertSucceeded(deployed, "HousieBoardService deployment");
  housie.note("Only ApexClass:HousieBoardService was selected. Apex tests were intentionally skipped; browser acceptance follows.");
});
