import test from "node:test";
import assert from "node:assert/strict";
import { resolveApexTestSelection } from "../../src/resolve-apex-test-selection.js";

test("validates Apex test modes and class names", () => {
  assert.deepEqual(resolveApexTestSelection("none"), { mode: "none", classes: [] });
  assert.deepEqual(resolveApexTestSelection("specified", "OneTest\nTwo_Test"), { mode: "specified", classes: ["OneTest", "Two_Test"] });
  assert.throws(() => resolveApexTestSelection("specified", ""), /1-30 unique/);
  assert.throws(() => resolveApexTestSelection("specified", "Bad-Class"), /1-30 unique/);
});
