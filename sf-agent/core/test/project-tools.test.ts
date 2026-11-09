import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createPlugin } from "../../plugins/project-tools.js";
import type { EngineRuntime, Logger } from "../types.js";

const logger: Logger = { debug() {}, info() {}, warn() {}, error() {} };

async function createFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sf-project-tools-"));
  const project = path.join(root, "project");
  const config = path.join(root, "config");
  await fs.mkdir(path.join(project, "force-app/main/default/classes"), { recursive: true });
  await fs.mkdir(path.join(project, "manifest"), { recursive: true });
  await fs.mkdir(config, { recursive: true });
  await fs.writeFile(path.join(project, "force-app/main/default/classes/Example.cls"), "public class Example {}");
  await fs.writeFile(path.join(project, "force-app/main/default/classes/Example.cls-meta.xml"), "<ApexClass/>");
  await fs.writeFile(path.join(project, "manifest/package.xml"), "<Package/>");
  execFileSync("git", ["init"], { cwd: project, stdio: "ignore" });
  execFileSync("git", ["add", "force-app", "manifest"], { cwd: project, stdio: "ignore" });

  const runtime: EngineRuntime = {
    configDirectory: config,
    log: logger,
    evidence: { async record() {}, async attach() { return ""; } }
  };
  const plugin = createPlugin({ projectDirectory: "../project" });
  return { root, project, tools: plugin.create({ projectDirectory: "../project" }, runtime) };
}

test("validates tracked source paths and includes Apex metadata companions", async () => {
  const fixture = await createFixture();
  try {
    const paths = await fixture.tools.resolveSourcePaths(["force-app/main/default/classes/Example.cls"]);
    assert.deepEqual(paths, [
      "force-app/main/default/classes/Example.cls",
      "force-app/main/default/classes/Example.cls-meta.xml"
    ]);
    assert.equal(await fixture.tools.resolveManifest("manifest/package.xml"), "manifest/package.xml");
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test("rejects traversal and symlink escapes", async () => {
  const fixture = await createFixture();
  try {
    const outside = path.join(fixture.root, "outside.cls");
    await fs.writeFile(outside, "outside");
    await fs.symlink(outside, path.join(fixture.project, "force-app/main/default/classes/Escape.cls"));
    await assert.rejects(
      () => fixture.tools.resolveSourcePaths(["force-app/main/default/classes/../Example.cls"]),
      /Invalid source path/
    );
    await assert.rejects(
      () => fixture.tools.resolveSourcePaths(["force-app/main/default/classes/Escape.cls"]),
      /resolves outside/
    );
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});

test("rejects output paths that traverse symlinks outside the project", async () => {
  const fixture = await createFixture();
  try {
    const outside = path.join(fixture.root, "outside");
    await fs.mkdir(outside);
    await fs.symlink(outside, path.join(fixture.project, "external"));
    await assert.rejects(
      () => fixture.tools.resolveOutputDirectory("external/new-output"),
      /symlink outside/
    );
  } finally {
    await fs.rm(fixture.root, { recursive: true, force: true });
  }
});
