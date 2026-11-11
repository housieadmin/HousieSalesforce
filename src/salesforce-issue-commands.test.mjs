import test from "node:test";
import assert from "node:assert/strict";
import { parseIssueCommand } from "./salesforce-issue-commands.mjs";

test("parses a deploy command into a workflow dispatch", () => {
  const result = parseIssueCommand([
    "/sf deploy",
    "ref: feature/my-change",
    "paths:",
    "- force-app/main/default/classes/Example.cls",
    "mode: standard",
    "tests: specified",
    "apex_test_classes:",
    "- ExampleTest",
    "confirm: DEPLOY"
  ].join("\n"));
  assert.equal(result.workflowId, "salesforce-ai-iteration-deploy.yml");
  assert.equal(result.inputs.source_ref, "feature/my-change");
  assert.equal(result.inputs.confirm_deployment, "DEPLOY");
});

test("parses retrieve commands and rejects mixed manifest selections", () => {
  const result = parseIssueCommand([
    "/sf retrieve",
    "paths:",
    "- force-app/main/default/classes/Example.cls",
    "create_pr: false"
  ].join("\n"));
  assert.equal(result.workflowId, "salesforce-org-sync.yml");
  assert.equal(result.inputs.create_pr, "false");
  assert.throws(() => parseIssueCommand([
    "/sf retrieve", "paths:", "- force-app/classes", "- manifest/custom.xml"
  ].join("\n")), /manifest XML path or component paths/);
});

test("rejects untrusted authors, invalid confirmations and invalid paths", () => {
  assert.throws(() => parseIssueCommand("/sf deploy", "MEMBER"), /Only repository owners/);
  assert.throws(() => parseIssueCommand([
    "/sf deploy", "ref: main", "paths:", "- force-app/classes/A.cls", "confirm: NO"
  ].join("\n")), /confirm: DEPLOY/);
  assert.throws(() => parseIssueCommand([
    "/sf deploy", "ref: main", "paths:", "- force-app/../escape", "confirm: DEPLOY"
  ].join("\n")), /Invalid metadata path/);
});
