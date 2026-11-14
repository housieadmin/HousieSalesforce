import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveMetadataPaths, splitSelections } from "../../src/resolve-metadata-paths.js";

test("splits selections and resolves tracked Apex source plus metadata companion", () => {
  assert.deepEqual(splitSelections("force-app/a, force-app/b\nforce-app/c"), ["force-app/a", "force-app/b", "force-app/c"]);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "metadata-test-"));
  fs.mkdirSync(path.join(root, "force-app/classes"), { recursive: true });
  fs.writeFileSync(path.join(root, "force-app/classes/Example.cls"), "class Example {}");
  fs.writeFileSync(path.join(root, "force-app/classes/Example.cls-meta.xml"), "<ApexClass/>");
  try {
    assert.deepEqual(resolveMetadataPaths("force-app/classes/Example.cls", {
      root, trackedFiles: ["force-app/classes/Example.cls", "force-app/classes/Example.cls-meta.xml"]
    }), ["force-app/classes/Example.cls-meta.xml", "force-app/classes/Example.cls"]);
    assert.throws(() => resolveMetadataPaths("force-app/../outside", { root }), /Rejected path/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
