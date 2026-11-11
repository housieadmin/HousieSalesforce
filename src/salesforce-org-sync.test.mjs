import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveRetrieveSelection } from "./salesforce-org-sync.mjs";

test("resolves selected component paths", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sf-retrieve-"));
  fs.mkdirSync(path.join(root, "force-app/classes"), { recursive: true });
  fs.writeFileSync(path.join(root, "force-app/classes/Example.cls"), "class Example {}");
  try {
    assert.deepEqual(resolveRetrieveSelection({
      pathsInput: "force-app/classes/Example.cls\nforce-app/classes/Example.cls",
      root
    }), { mode: "source", paths: ["force-app/classes/Example.cls"] });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("rejects traversal and simultaneous paths plus custom manifest", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sf-retrieve-invalid-"));
  fs.mkdirSync(path.join(root, "force-app"), { recursive: true });
  fs.mkdirSync(path.join(root, "manifest"), { recursive: true });
  fs.writeFileSync(path.join(root, "manifest/custom.xml"), "<Package/>");
  try {
    assert.throws(() => resolveRetrieveSelection({ pathsInput: "force-app/../outside", root }), /Invalid component path/);
    assert.throws(() => resolveRetrieveSelection({ pathsInput: "force-app/classes", manifest: "manifest/custom.xml", root }), /OR a manifest/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("resolves only manifest XML inside manifest/", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sf-retrieve-manifest-"));
  fs.mkdirSync(path.join(root, "manifest"));
  fs.writeFileSync(path.join(root, "manifest/package-retrieve.xml"), "<Package/>");
  try {
    assert.deepEqual(resolveRetrieveSelection({ root }), { mode: "manifest", manifest: "manifest/package-retrieve.xml" });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
