import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { validateScenarios } from "./parse-browser-request.js";

export function runBrowserTests(env = process.env) {
  const scenarios = JSON.parse(env.SCENARIOS_JSON || "[]");
  validateScenarios(scenarios);
  const files = scenarios.map(file => path.relative("tests/browser", file));
  const artifactDir = path.resolve(env.BROWSER_ARTIFACT_DIR || "artifacts/browser");
  fs.mkdirSync(artifactDir, { recursive: true });
  const result = spawnSync(process.execPath, [
    path.join(process.cwd(), "node_modules", "@playwright", "test", "cli.js"), "test", ...files
  ], { stdio: "inherit", env });
  const exitCode = result.status ?? 1;
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, "test_exit=" + exitCode + "\n");
  let report = { suites: [] };
  try { report = JSON.parse(fs.readFileSync(path.join(artifactDir, "playwright-report.json"), "utf8")); } catch {}
  const specs = [];
  const visit = suites => (suites || []).forEach(suite => {
    (suite.specs || []).forEach(spec => (spec.tests || []).forEach(test => specs.push({
      title: spec.title, file: spec.file, status: test.results?.at(-1)?.status || "unknown"
    })));
    visit(suite.suites);
  });
  visit(report.suites);
  const summary = [
    "# Browser test execution summary", "",
    "- Tests observed: " + specs.length,
    "- Passed: " + specs.filter(x => x.status === "passed").length,
    "- Failed: " + specs.filter(x => ["failed", "timedOut"].includes(x.status)).length,
    "- Playwright exit code: " + exitCode, ""
  ].join("\n");
  fs.writeFileSync(path.join(artifactDir, "summary.md"), summary);
  fs.writeFileSync(path.join(artifactDir, "execution-summary.json"), JSON.stringify({ specs, exitCode }, null, 2));
  return exitCode;
}

if (process.argv[1]?.endsWith("/run-browser-tests.js")) process.exitCode = runBrowserTests();
