import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function resolveScenarioPaths(files, scenariosRoot = path.resolve("scenarios")) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 10 ||
    new Set(files).size !== files.length ||
    files.some(file => typeof file !== "string" ||
      !/^browser-agent\/scenarios\/[A-Za-z0-9._/-]+\.spec\.ts$/.test(file) ||
      file.includes("..") || file.includes("//"))) {
    throw new Error("Invalid scenario list");
  }
  return files.map(file => {
    const relative = path.relative("browser-agent/scenarios", file);
    const resolved = path.resolve(scenariosRoot, relative);
    const fromRoot = path.relative(scenariosRoot, resolved);
    if (!fromRoot || fromRoot.startsWith(".." + path.sep) || path.isAbsolute(fromRoot) ||
      !fs.existsSync(resolved) || !fs.lstatSync(resolved).isFile()) {
      throw new Error("Scenario missing or outside scenario directory: " + file);
    }
    return path.relative(process.cwd(), resolved);
  });
}

function flattenSuites(suites, output = []) {
  for (const suite of suites || []) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) output.push({ title: spec.title, file: spec.file, results: test.results || [] });
    }
    flattenSuites(suite.suites, output);
  }
  return output;
}

export function summarizeReport(report, testExit) {
  const tests = flattenSuites(report?.suites);
  const failed = tests.filter(test => test.results.some(result => ["failed", "timedOut"].includes(result.status)));
  const passed = tests.filter(test => test.results.some(result => result.status === "passed"));
  return {
    total: tests.length,
    passed: passed.length,
    failed: failed.length,
    failedTests: failed,
    markdown: [
      "# Browser execution summary", "",
      "- Tests observed: " + tests.length,
      "- Passed: " + passed.length,
      "- Failed/timed out: " + failed.length,
      "- Playwright exit code: " + testExit,
      "",
      "This report records browser observations; it does not certify feature completeness.", ""
    ].join("\n")
  };
}

export function runSelectedScenarios(env = process.env) {
  const files = JSON.parse(env.SCENARIOS_JSON || "[]");
  const selected = resolveScenarioPaths(files, path.resolve("scenarios"));
  const artifactDir = path.resolve(env.BROWSER_AGENT_ARTIFACT_DIR || "artifacts/local-run");
  fs.mkdirSync(artifactDir, { recursive: true });
  const sourceCheckout = path.resolve(process.cwd(), "..", "..", ".browser-agent-source");
  const sourceCommit = execFileSync("git", ["-C", sourceCheckout, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  fs.writeFileSync(path.join(artifactDir, "run-metadata.json"), JSON.stringify({
    runId: env.GITHUB_RUN_ID,
    attempt: env.GITHUB_RUN_ATTEMPT,
    sourceRef: env.REQUESTED_REF,
    sourceCommit,
    scenarios: files,
    description: env.RUN_DESCRIPTION
  }, null, 2));
  const cli = path.join(process.cwd(), "node_modules", "@playwright", "test", "cli.js");
  const result = spawnSync(process.execPath, [cli, "test", ...selected], { stdio: "inherit", env });
  const testExit = result.status === null ? 1 : result.status;
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, "test_exit=" + testExit + "\n");
  let report = null;
  try { report = JSON.parse(fs.readFileSync(path.join(artifactDir, "playwright-report.json"), "utf8")); } catch {}
  const summary = summarizeReport(report, testExit);
  fs.writeFileSync(path.join(artifactDir, "summary.md"), summary.markdown);
  fs.writeFileSync(path.join(artifactDir, "execution-summary.json"), JSON.stringify({
    total: summary.total, passed: summary.passed, failed: summary.failed, failedTests: summary.failedTests
  }, null, 2));
  return testExit;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = runSelectedScenarios();
}
