import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { stageScenarios } from "./stage-scenarios.mjs";

test("stages selected scenarios and TypeScript utilities only", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "browser-stage-"));
  const source = path.join(root, "source");
  const runtime = path.join(root, "runtime");
  const scenario = "browser-agent/scenarios/sample.spec.ts";
  fs.mkdirSync(path.join(source, "browser-agent/scenarios"), { recursive: true });
  fs.mkdirSync(path.join(source, "browser-agent/utilities"), { recursive: true });
  fs.writeFileSync(path.join(source, scenario), "test('sample', () => {});");
  fs.writeFileSync(path.join(source, "browser-agent/utilities/helper.ts"), "export const helper = true;");
  fs.writeFileSync(path.join(source, "browser-agent/utilities/README.md"), "not executable");
  try {
    stageScenarios({ scenarios: [scenario], sourceCheckout: source, runtimeCheckout: runtime });
    assert.equal(fs.readFileSync(path.join(runtime, scenario), "utf8"), "test('sample', () => {});");
    assert.equal(fs.readFileSync(path.join(runtime, "browser-agent/utilities/helper.ts"), "utf8"), "export const helper = true;");
    assert.equal(fs.existsSync(path.join(runtime, "browser-agent/utilities/README.md")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects traversal and missing scenario files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "browser-stage-invalid-"));
  try {
    assert.throws(() => stageScenarios({ scenarios: ["browser-agent/scenarios/../escape.spec.ts"], sourceCheckout: root, runtimeCheckout: root }), /Invalid scenario list/);
    assert.throws(() => stageScenarios({ scenarios: ["browser-agent/scenarios/missing.spec.ts"], sourceCheckout: root, runtimeCheckout: root }), /ENOENT/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
