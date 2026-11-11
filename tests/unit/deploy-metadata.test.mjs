import test from "node:test";
import assert from "node:assert/strict";
import { deployMetadata } from "../../src/deploy-metadata.js";

test("requires exactly one deployment source", () => {
  assert.throws(() => deployMetadata({ paths: [], targetOrg: "dev" }), /either source paths or one manifest/);
  assert.throws(() => deployMetadata({ paths: ["force-app/a"], manifest: "manifest/package.xml", targetOrg: "dev" }), /either source paths or one manifest/);
});
