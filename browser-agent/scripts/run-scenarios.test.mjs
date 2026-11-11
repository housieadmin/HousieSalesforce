import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveScenarioPaths, summarizeReport } from "./run-scenarios.mjs";

test("resolves only selected scenario files inside the scenario directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "browser-scenario-path-"));
  fs.writeFileSync(path.join(root, "sample.spec.ts"), "test('sample', () => {});");
  try {
    const paths = resolveScenarioPaths(["browser-agent/scenarios/sample.spec.ts"], root);
    assert.deepEqual(paths, [path.relative(process.cwd(), path.join(root, "sample.spec.ts"))]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects traversal and duplicate scenario selections", () => {
  assert.throws(() => resolveScenarioPaths(["browser-agent/scenarios/../escape.spec.ts"]), /Invalid scenario list/);
  assert.throws(() => resolveScenarioPaths([
    "browser-agent/scenarios/a.spec.ts",
    "browser-agent/scenarios/a.spec.ts"
  ]), /Invalid scenario list/);
});

test("summarizes Playwright results", () => {
  const summary = summarizeReport({ suites: [{ specs: [
    { title: "works", file: "a.spec.ts", tests: [{ results: [{ status: "passed" }] }] },
    { title: "fails", file: "b.spec.ts", tests: [{ results: [{ status: "failed" }] }] }
  ] }] }, 1);
  assert.deepEqual({ total: summary.total, passed: summary.passed, failed: summary.failed }, { total: 2, passed: 1, failed: 1 });
  assert.match(summary.markdown, /Playwright exit code: 1/);
});
