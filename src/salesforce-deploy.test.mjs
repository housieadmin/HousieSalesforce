import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveManifestPath, resolveMetadataPaths, resolveTestSelection, splitSelections } from "./salesforce-deploy.mjs";

test("splits comma and newline metadata selections", () => {
  assert.deepEqual(splitSelections("force-app/a, force-app/b\nforce-app/c"), ["force-app/a", "force-app/b", "force-app/c"]);
});

test("resolves tracked component paths and Apex metadata companions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sf-deploy-paths-"));
  fs.mkdirSync(path.join(root, "force-app/classes"), { recursive: true });
  fs.writeFileSync(path.join(root, "force-app/classes/Example.cls"), "class Example {}");
  fs.writeFileSync(path.join(root, "force-app/classes/Example.cls-meta.xml"), "<ApexClass/>");
  try {
    assert.deepEqual(resolveMetadataPaths("force-app/classes/Example.cls", {
      root, trackedFiles: ["force-app/classes/Example.cls", "force-app/classes/Example.cls-meta.xml"]
    }), ["force-app/classes/Example.cls-meta.xml", "force-app/classes/Example.cls"]);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("rejects traversal and untracked paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sf-deploy-invalid-"));
  fs.mkdirSync(path.join(root, "force-app/classes"), { recursive: true });
  fs.writeFileSync(path.join(root, "force-app/classes/Example.cls"), "class Example {}");
  try {
    assert.throws(() => resolveMetadataPaths("force-app/../manifest/package.xml", { root }), /Rejected path/);
    assert.throws(() => resolveMetadataPaths("force-app/classes/Example.cls", { root, trackedFiles: [] }), /not tracked/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("resolves standard and custom manifests inside manifest/", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sf-manifest-"));
  fs.mkdirSync(path.join(root, "manifest"));
  fs.writeFileSync(path.join(root, "manifest/package.xml"), "<Package/>");
  fs.writeFileSync(path.join(root, "manifest/custom.xml"), "<Package/>");
  try {
    assert.equal(resolveManifestPath("application", "", { root }), "manifest/package.xml");
    assert.equal(resolveManifestPath("custom", "manifest/custom.xml", { root }), "manifest/custom.xml");
    assert.throws(() => resolveManifestPath("custom", "../package.xml", { root }), /safe XML path/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("validates Apex test selections", () => {
  assert.deepEqual(resolveTestSelection("none"), { mode: "none", classes: [] });
  assert.deepEqual(resolveTestSelection("specified", "OneTest\nTwo_Test"), { mode: "specified", classes: ["OneTest", "Two_Test"] });
  assert.throws(() => resolveTestSelection("specified", ""), /requires valid/);
  assert.throws(() => resolveTestSelection("specified", "Bad-Class"), /requires valid/);
});
