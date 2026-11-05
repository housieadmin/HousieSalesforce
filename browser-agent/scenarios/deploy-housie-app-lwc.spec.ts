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
      // Try the other stream.
    }
  }
  return null;
}

function deploy(args: string[], cwd: string, label: string) {
  const result = spawnSync("sf", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120000
  });
  const response = parseCliJson(String(result.stdout ?? ""), String(result.stderr ?? ""));
  if (!response) {
    throw new Error(label + " returned no parseable JSON. "
      + String(result.stderr ?? "").slice(-1200).replace(/[a-f0-9]{32}/gi, "[REDACTED]"));
  }
  const resultData = (response.result ?? {}) as Record<string, unknown>;
  const details = (resultData.details ?? {}) as Record<string, unknown>;
  const summary = {
    cliStatus: result.status,
    status: resultData.status ?? null,
    successfulComponents: Array.isArray(details.componentSuccesses)
      ? details.componentSuccesses.map((item: any) => ({
          type: item.componentType || null,
          name: item.fullName || item.fileName || null
        }))
      : [],
    failures: Array.isArray(details.componentFailures)
      ? details.componentFailures.map((item: any) => ({
          type: item.componentType || null,
          name: item.fullName || item.fileName || null,
          problem: String(item.problem || item.message || "").slice(0, 1000)
        }))
      : []
  };
  return { summary, rawStatus: result.status };
}

function assertSucceeded(run: ReturnType<typeof deploy>, label: string) {
  expect(run.rawStatus, label + " CLI status. " + JSON.stringify(run.summary)).toBe(0);
  expect(run.summary.status, label + " deployment status. " + JSON.stringify(run.summary)).toBe("Succeeded");
  expect(run.summary.failures, label + " component failures. " + JSON.stringify(run.summary)).toEqual([]);
  expect(run.summary.successfulComponents, label + " must include LightningComponentBundle:housieApp.")
    .toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "LightningComponentBundle", name: "housieApp" })
    ]));
}

test("deploy only the Housie public app token-route fix", async ({ housie }) => {
  const sourceRoot = path.resolve(process.cwd(), "../../.browser-agent-source");
  const common = [
    "project", "deploy", "start",
    "--metadata", "LightningComponentBundle:housieApp",
    "--target-org", "housie-browser-agent",
    "--test-level", "NoTestRun",
    "--wait", "60",
    "--json"
  ];
  const preview = deploy([...common, "--dry-run"], sourceRoot, "housieApp LWC dry-run");
  housie.note("housieApp LWC dry-run: " + JSON.stringify(preview.summary));
  assertSucceeded(preview, "housieApp LWC dry-run");
  const deployed = deploy(common, sourceRoot, "housieApp LWC deployment");
  housie.note("housieApp LWC deployment: " + JSON.stringify(deployed.summary));
  assertSucceeded(deployed, "housieApp LWC deployment");
  housie.note("Only LightningComponentBundle:housieApp was selected; no Apex tests were run.");
});
