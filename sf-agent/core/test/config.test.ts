import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadConfig, validateConfig } from "../config.js";

test("supports independent engines, utility plugins and mixed operations", () => {
  const config = validateConfig({
    version: 1,
    plugins: [
      { id: "sf-cli", module: "@sf-agent/sf-cli" },
      { id: "sf-browser", module: "@sf-agent/sf-browser" },
      { id: "shared-tools", kind: "utility", module: "./shared-tools.ts" }
    ],
    operations: {
      deploy: { scenario: "./deploy.ts", engines: ["sf-cli"], utilities: ["shared-tools"] },
      browser: { scenario: "./browser.ts", engines: ["sf-browser"] },
      full: { scenario: "./full.ts", engines: ["sf-cli", "sf-browser"], utilities: ["shared-tools"] }
    }
  });
  assert.deepEqual(config.operations.full.engines, ["sf-cli", "sf-browser"]);
  assert.deepEqual(config.operations.full.utilities, ["shared-tools"]);
});

test("rejects duplicate plugins and cross-kind references", () => {
  assert.throws(() => validateConfig({
    version: 1,
    plugins: [{ id: "sf-cli", module: "x" }, { id: "sf-cli", module: "y" }],
    operations: { invalid: { scenario: "./x.ts", engines: [] } }
  }), /Duplicate plugin/);

  assert.throws(() => validateConfig({
    version: 1,
    plugins: [{ id: "common", kind: "utility", module: "./common.ts" }],
    operations: { invalid: { scenario: "./x.ts", engines: ["common"] } }
  }), /registered engine plugins/);
});

test("rejects invalid timeout values", () => {
  assert.throws(() => validateConfig({
    version: 1,
    defaults: { timeoutMs: 0 },
    plugins: [],
    operations: { noop: { scenario: "./x.ts", engines: [] } }
  }), /Invalid defaults/);
});

test("optional environment values do not block unrelated operations", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sf-agent-config-"));
  const file = path.join(directory, "config.yml");
  try {
    delete process.env.SF_AGENT_OPTIONAL_TEST;
    await fs.writeFile(file, [
      "version: 1",
      "plugins:",
      "  - id: sf-cli",
      "    module: package",
      "  - id: sf-browser",
      "    module: package",
      "    options:",
      '      baseUrl: "${ENV:SF_AGENT_OPTIONAL_TEST:-}"',
      "operations:",
      "  deploy:",
      "    scenario: ./deploy.mjs",
      "    engines: [sf-cli]"
    ].join("\n"));
    const { config } = await loadConfig(file);
    assert.equal(config.plugins[1].options?.baseUrl, "");
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
