import test from "node:test";
import assert from "node:assert/strict";
import { parseBrowserRequest, validateScenarios } from "../../src/parse-browser-request.js";

test("parses an E2E issue request", () => {
  const result = parseBrowserRequest([
    "/e2e run", "ref: feature/change", "scenarios:", "- tests/e2e/sample.spec.ts", "description: smoke"
  ].join("\n"));
  assert.deepEqual(result, { ref: "feature/change", scenarios: ["tests/e2e/sample.spec.ts"], description: "smoke" });
});
test("rejects unsafe or duplicate scenario paths", () => {
  assert.throws(() => validateScenarios(["tests/e2e/../secret.spec.ts"]), /tests under/);
  assert.throws(() => validateScenarios(["tests/e2e/a.spec.ts", "tests/e2e/a.spec.ts"]), /tests under/);
});
