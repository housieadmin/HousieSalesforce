import test from "node:test";
import assert from "node:assert/strict";
import { parseBrowserRequest, validateScenarios } from "../../src/parse-browser-request.js";

test("parses an browser issue request", () => {
  const result = parseBrowserRequest([
    "/browser run", "ref: feature/change", "scenarios:", "- tests/browser/sample.spec.ts", "description: smoke"
  ].join("\n"));
  assert.deepEqual(result, { ref: "feature/change", scenarios: ["tests/browser/sample.spec.ts"], description: "smoke" });
});
test("rejects unsafe or duplicate scenario paths", () => {
  assert.throws(() => validateScenarios(["tests/browser/../secret.spec.ts"]), /tests\/browser/);
  assert.throws(() => validateScenarios(["tests/browser/a.spec.ts", "tests/browser/a.spec.ts"]), /tests under/);
});
