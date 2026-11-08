import test from "node:test";
import assert from "node:assert/strict";
import { defineScenario, defineWorkflow } from "./scenario";

test("defines an independently executable scenario without requiring assertions", () => {
  const scenario = defineScenario({ id: "capture", async run() {} });
  assert.equal(scenario.kind, "scenario");
  assert.equal(scenario.id, "capture");
});

test("composes existing scenarios without duplicating their implementation", () => {
  const first = defineScenario({ id: "navigate", async run() {} });
  const second = defineScenario({ id: "capture", async run() {} });
  const workflow = defineWorkflow({ id: "inspect", scenarios: [first, second] });
  assert.deepEqual(workflow.scenarios, [first, second]);
  assert.equal(workflow.kind, "workflow");
});

test("rejects malformed identifiers and empty workflows", () => {
  assert.throws(() => defineScenario({ id: "../unsafe", async run() {} }), /filesystem-safe/);
  assert.throws(() => defineWorkflow({ id: "empty", scenarios: [] }), /at least one/);
});
