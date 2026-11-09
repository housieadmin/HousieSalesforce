import test from "node:test";
import assert from "node:assert/strict";
import { deployWithPolicy } from "../../scenarios/operations/deployment.js";
import type { ScenarioContext } from "../types.js";

function mockContext(inputs: Record<string, unknown>, calls: string[]) {
  const cli = {
    async deploy(options: { dryRun?: boolean }) {
      calls.push(options.dryRun ? "dry-run" : "deploy");
      return { stdout: "ok", stderr: "", exitCode: 0 };
    },
    async runApexTests() {
      calls.push("tests");
      return { stdout: "tests-ok", stderr: "", exitCode: 0 };
    }
  };
  const tools = {
    requireConfirmation(value: unknown, expected: string) {
      if (value !== expected) throw new Error(`confirmation ${expected} required`);
    },
    requireTargetOrg(value: unknown) { return String(value); },
    async resolveSourcePaths(value: unknown) { return value as string[]; },
    async resolveManifest(value: unknown) { return String(value); },
    validateApexClasses(value: unknown) {
      if (!Array.isArray(value) || value.length < 1 || value.length > 30 ||
        value.some(item => typeof item !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(item)) ||
        new Set(value).size !== value.length) throw new Error("invalid test classes");
      return value as string[];
    }
  };
  return {
    operation: "test",
    inputs,
    engine: () => cli,
    utility: () => tools
  } as unknown as ScenarioContext;
}

test("standard deploy validates, deploys and then runs specified tests", async () => {
  const calls: string[] = [];
  const result = await deployWithPolicy(mockContext({
    confirmation: "DEPLOY",
    targetOrg: "target-org",
    sourcePaths: ["force-app/main/default/classes/Example.cls"],
    testMode: "specified",
    apexTestClasses: ["ExampleTest"]
  }, calls), "DEPLOY");
  assert.deepEqual(calls, ["dry-run", "deploy", "tests"]);
  assert.equal(result.testMode, "specified");
});

test("invalid Apex test selection is rejected before deployment", async () => {
  const calls: string[] = [];
  await assert.rejects(() => deployWithPolicy(mockContext({
    confirmation: "DEPLOY",
    targetOrg: "target-org",
    sourcePaths: ["force-app/main/default/classes/Example.cls"],
    testMode: "specified",
    apexTestClasses: []
  }, calls), "DEPLOY"), /invalid test classes/);
  assert.deepEqual(calls, []);
});

test("fast mode cannot be combined with Apex tests", async () => {
  const calls: string[] = [];
  await assert.rejects(() => deployWithPolicy(mockContext({
    confirmation: "DEPLOY",
    targetOrg: "target-org",
    sourcePaths: ["force-app/main/default/classes/Example.cls"],
    deploymentMode: "fast",
    testMode: "local"
  }, calls), "DEPLOY"), /requires testMode=none/);
  assert.deepEqual(calls, []);
});

test("restore always validates before deployment", async () => {
  const calls: string[] = [];
  const result = await deployWithPolicy(mockContext({
    confirmation: "RESTORE",
    targetOrg: "target-org",
    sourcePaths: ["force-app/main/default/classes/Example.cls"],
    runLocalTests: true
  }, calls), "RESTORE");
  assert.deepEqual(calls, ["dry-run", "deploy", "tests"]);
  assert.equal(result.deploymentMode, "standard");
});
