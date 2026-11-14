import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveManifestPath } from "../../src/resolve-manifest-path.js";

test("resolves manifests only from the manifest directory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-test-"));
  fs.mkdirSync(path.join(root, "manifest"));
  fs.writeFileSync(path.join(root, "manifest/package.xml"), "<Package/>");
  fs.writeFileSync(path.join(root, "manifest/custom.xml"), "<Package/>");
  try {
    assert.equal(resolveManifestPath("application", "", { root }), "manifest/package.xml");
    assert.equal(resolveManifestPath("custom", "manifest/custom.xml", { root }), "manifest/custom.xml");
    assert.throws(() => resolveManifestPath("custom", "../outside.xml", { root }), /safe XML path/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
