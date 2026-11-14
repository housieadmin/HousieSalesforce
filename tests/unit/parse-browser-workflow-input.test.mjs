import test from "node:test";
import assert from "node:assert/strict";
import { parseBrowserWorkflowInput } from "../../src/parse-browser-workflow-input.js";

test("validates reusable browser workflow inputs", () => {
  assert.deepEqual(parseBrowserWorkflowInput({
    requestedRef: "feature/change", scenariosJson: '["tests/e2e/sample.spec.ts"]', description: "smoke"
  }), { ref: "feature/change", scenarios: ["tests/e2e/sample.spec.ts"], description: "smoke" });
});
