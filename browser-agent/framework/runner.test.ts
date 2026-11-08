import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runDefinition } from "./runner";
import type { BrowserAgentConfig } from "./config";
import { defineScenario, defineWorkflow } from "./scenario";

test("executes an evidence-only scenario in Chromium and writes results", async () => {
  const artifactsDir = fs.mkdtempSync(path.join(os.tmpdir(), "browser-agent-runner-"));
  const config: BrowserAgentConfig = {
    baseUrl: "https://example.invalid",
    startUrl: "data:text/html,<html><head><title>Browser Agent Smoke</title></head><body><main>ready</main></body></html>",
    headless: true,
    slowMo: 0,
    navigationTimeoutMs: 10000,
    actionTimeoutMs: 10000,
    traceOnFailure: false,
    artifactsDir,
    viewport: { width: 800, height: 600 },
    project: {}
  };
  const scenario = defineScenario({
    id: "evidence-smoke",
    async run({ page, screenshot, log }) {
      log("Read-only page inspection", { title: await page.title() });
      await screenshot("home");
    }
  });
  try {
    const result = await runDefinition(scenario, config);
    assert.equal(result.status, "completed");
    assert.ok(fs.existsSync(path.join(result.artifactDir, "result.json")));
    assert.ok(fs.existsSync(path.join(result.artifactDir, "events.json")));
    assert.ok(fs.existsSync(path.join(result.artifactDir, "screenshots", "home.png")));
    const events = JSON.parse(fs.readFileSync(path.join(result.artifactDir, "events.json"), "utf8"));
    assert.ok(events.some((event: { message: string }) => event.message === "Read-only page inspection"));
  } finally {
    fs.rmSync(artifactsDir, { recursive: true, force: true });
  }
});

test("runs composed workflow steps sequentially in one browser session", async () => {
  const artifactsDir = fs.mkdtempSync(path.join(os.tmpdir(), "browser-agent-workflow-"));
  const config: BrowserAgentConfig = {
    baseUrl: "https://example.invalid",
    startUrl: "data:text/html,<html><head><title>Workflow Smoke</title></head><body>ready</body></html>",
    headless: true,
    slowMo: 0,
    navigationTimeoutMs: 10000,
    actionTimeoutMs: 10000,
    traceOnFailure: false,
    artifactsDir,
    viewport: { width: 800, height: 600 },
    project: {}
  };
  const observed: string[] = [];
  const first = defineScenario({ id: "first", async run({ page }) { observed.push(await page.title()); } });
  const second = defineScenario({ id: "second", async run({ page }) { observed.push(await page.title()); } });
  const workflow = defineWorkflow({ id: "workflow-smoke", scenarios: [first, second] });
  try {
    const result = await runDefinition(workflow, config);
    assert.equal(result.status, "completed");
    assert.deepEqual(observed, ["Workflow Smoke", "Workflow Smoke"]);
  } finally {
    fs.rmSync(artifactsDir, { recursive: true, force: true });
  }
});
