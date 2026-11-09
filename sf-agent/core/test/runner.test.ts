import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runOperation } from "../runner.js";

test("runs an engine and utility plugin and closes both instances", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sf-agent-runner-"));
  try {
    await fs.writeFile(path.join(directory, "engine.mjs"),
      'export function createPlugin(){return{id:"mock-engine",create(){return{value:42,close(){globalThis.__engineClosed=true}}}}}');
    await fs.writeFile(path.join(directory, "utility.mjs"),
      'export function createPlugin(){return{id:"mock-utility",create(){return{prefix:"ok",close(){globalThis.__utilityClosed=true}}}}}');
    await fs.writeFile(path.join(directory, "scenario.mjs"),
      'export default {name:"mock-run",async run(ctx){return{value:ctx.engine("mock-engine").value,label:ctx.utility("mock-utility").prefix,input:ctx.inputs.flag}}}');
    await fs.writeFile(path.join(directory, "config.yml"), [
      "version: 1",
      "defaults:",
      "  evidenceDirectory: evidence",
      "plugins:",
      "  - id: mock-engine",
      "    module: ./engine.mjs",
      "  - id: mock-utility",
      "    kind: utility",
      "    module: ./utility.mjs",
      "operations:",
      "  test:",
      "    scenario: ./scenario.mjs",
      "    engines: [mock-engine]",
      "    utilities: [mock-utility]",
      "    inputs:",
      "      flag: enabled"
    ].join("\n"));

    delete (globalThis as { __engineClosed?: boolean }).__engineClosed;
    delete (globalThis as { __utilityClosed?: boolean }).__utilityClosed;
    const result = await runOperation(path.join(directory, "config.yml"), "test");
    assert.equal(result.status, "completed");
    assert.equal((globalThis as { __engineClosed?: boolean }).__engineClosed, true);
    assert.equal((globalThis as { __utilityClosed?: boolean }).__utilityClosed, true);
    assert.equal(await fs.readdir(path.join(directory, "evidence")).then(files => files.length), 1);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
