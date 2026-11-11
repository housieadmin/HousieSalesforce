import test from "node:test";
import assert from "node:assert/strict";
import { parseWorkflowCall } from "./parse-workflow-call.mjs";

const scenario = "browser-agent/scenarios/inspect-housie-account.spec.ts";

test("validates reusable workflow inputs", () => {
  assert.deepEqual(parseWorkflowCall({
    requestedRef: "feature/check",
    scenariosJson: JSON.stringify([scenario]),
    description: "Inspect account"
  }), { ref: "feature/check", scenarios: [scenario], description: "Inspect account" });
});

test("rejects traversal and duplicate scenario paths", () => {
  assert.throws(() => parseWorkflowCall({
    requestedRef: "main",
    scenariosJson: JSON.stringify(["browser-agent/scenarios/../escape.spec.ts"])
  }), /scenario files/);
  assert.throws(() => parseWorkflowCall({
    requestedRef: "main",
    scenariosJson: JSON.stringify([scenario, scenario])
  }), /scenario files/);
});

test("rejects invalid source refs and non-array input", () => {
  assert.throws(() => parseWorkflowCall({ requestedRef: "../main", scenariosJson: JSON.stringify([scenario]) }), /source ref/);
  assert.throws(() => parseWorkflowCall({ requestedRef: "main", scenariosJson: "{}" }), /scenario files/);
});
