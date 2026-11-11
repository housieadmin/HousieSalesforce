import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveRetrieveSelection } from "../../src/resolve-retrieve-selection.js";

test("resolves component selections and manifest selections", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "retrieve-test-"));
  fs.mkdirSync(path.join(root, "force-app/classes"), { recursive: true });
  fs.mkdirSync(path.join(root, "manifest"), { recursive: true });
  fs.writeFileSync(path.join(root, "force-app/classes/Example.cls"), "class Example {}");
  fs.writeFileSync(path.join(root, "manifest/package-retrieve.xml"), "<Package/>");
  try {
    assert.deepEqual(resolveRetrieveSelection({ pathsInput: "force-app/classes/Example.cls", root }), {
      mode: "source", paths: ["force-app/classes/Example.cls"]
    });
    assert.deepEqual(resolveRetrieveSelection({ root }), { mode: "manifest", manifest: "manifest/package-retrieve.xml" });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
