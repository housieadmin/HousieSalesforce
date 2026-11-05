import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";

function runDeploy(args: string[], cwd: string, label: string): Record<string, unknown> {
  try {
    const output = execFileSync("sf", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 8 * 1024 * 1024
    });
    const clean = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
    const start = clean.indexOf("{");
    if (start < 0) throw new Error(label + " returned no JSON response.");
    const parsed = JSON.parse(clean.slice(start)) as Record<string, unknown>;
    if (parsed.status !== 0) throw new Error(label + " returned a non-zero Salesforce CLI status.");
    return parsed;
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stdout?: string | Buffer; stderr?: string | Buffer };
    const detail = [failure.stderr, failure.stdout, failure.message]
      .map(value => String(value ?? ""))
      .filter(Boolean)
      .join("\n")
      .replace(/\u001b\[[0-9;]*m/g, "")
      .replace(/[a-f0-9]{32}/gi, "[REDACTED_ID_OR_KEY]")
      .slice(0, 3000);
    throw new Error(label + " failed. " + detail);
  }
}

test("deploy only HousieGameTicketService to the authorized Developer Org", async ({ housie }) => {
  const sourceRoot = path.resolve(process.cwd(), "../../.browser-agent-source");
  const metadata = ["ApexClass:HousieGameTicketService"];
  const common = [
    "project", "deploy", "start",
    "--metadata", metadata[0],
    "--target-org", "housie-browser-agent",
    "--test-level", "RunLocalTests",
    "--wait", "60",
    "--json"
  ];

  const preview = runDeploy(
    [...common.slice(0, 2), ...common.slice(2), "--dry-run"],
    sourceRoot,
    "HousieGameTicketService deployment validation"
  );
  housie.note("Narrow deployment dry-run passed for ApexClass:HousieGameTicketService. No other metadata was selected.");

  const deployed = runDeploy(common, sourceRoot, "HousieGameTicketService deployment");
  const result = (deployed.result ?? {}) as Record<string, unknown>;
  const details = (result.details ?? {}) as Record<string, unknown>;
  const successes = Array.isArray(details.componentSuccesses) ? details.componentSuccesses : [];
  const failures = Array.isArray(details.componentFailures) ? details.componentFailures : [];
  const tests = (details.runTestResult ?? {}) as Record<string, unknown>;

  expect(failures, "The targeted Apex deployment must report no component failures").toHaveLength(0);
  expect(result.status, "Salesforce must report the targeted deployment as successful").toBe("Succeeded");
  housie.note("Deployment result=" + String(result.status ?? "unknown")
    + "; successful components=" + successes.length
    + "; test summary=" + JSON.stringify({
      numTestsRun: tests.numTestsRun,
      numFailures: tests.numFailures,
      numTestsCompleted: tests.numTestsCompleted
    }));
});
