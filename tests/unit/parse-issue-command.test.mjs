import test from "node:test";
import assert from "node:assert/strict";
import { parseIssueCommand } from "../../src/parse-issue-command.js";

test("parses a deploy request into workflow inputs", () => {
  const result = parseIssueCommand([
    "/sf deploy", "ref: feature/change", "paths:", "- force-app/classes/Example.cls",
    "mode: standard", "tests: specified", "apex_test_classes:", "- ExampleTest", "confirm: DEPLOY"
  ].join("\n"));
  assert.equal(result.workflowId, "salesforce-ai-iteration-deploy.yml");
  assert.equal(result.inputs.source_ref, "feature/change");
});
test("parses E2E scenario paths and rejects invalid input", () => {
  const result = parseIssueCommand([
    "/sf deploy-and-verify", "ref: feature/change", "paths:", "- force-app/classes/Example.cls",
    "scenarios:", "- tests/e2e/sample.spec.ts", "confirm: DEPLOY"
  ].join("\n"));
  assert.equal(result.inputs.scenarios_json, '["tests/e2e/sample.spec.ts"]');
  assert.throws(() => parseIssueCommand("/sf deploy", "MEMBER"), /repository owners/);
  assert.throws(() => parseIssueCommand([
    "/sf deploy", "ref: main", "paths:", "- force-app/../bad", "confirm: DEPLOY"
  ].join("\n")), /paths under force-app/);
});
