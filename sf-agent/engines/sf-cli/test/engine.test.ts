import test from "node:test";
import assert from "node:assert/strict";
import { SfCliEngine } from "../index.js";

test("executes argument arrays without a shell", async () => {
  const cli = new SfCliEngine({ binary: process.execPath });
  const result = await cli.run(["-e", "process.stdout.write(process.argv[1])", "safe-value"]);
  assert.equal(result.stdout, "safe-value");
});

test("rejects empty commands", () => {
  const cli = new SfCliEngine({ binary: process.execPath });
  assert.throws(() => cli.run([]), /non-empty array/);
});

test("validates Apex test class selection before process execution", async () => {
  const cli = new SfCliEngine({ binary: process.execPath });
  await assert.rejects(
    () => cli.runApexTests({ targetOrg: "target-org", testLevel: "RunSpecifiedTests" }),
    /requires valid Apex class names/
  );
});

test("requires an explicit retrieval selection", async () => {
  const cli = new SfCliEngine({ binary: process.execPath });
  await assert.rejects(
    () => cli.retrieve({ targetOrg: "target-org" }),
    /requires a manifest, sourceDirs or metadata/
  );
});

test("rejects non-HTTPS org endpoints before login", async () => {
  const cli = new SfCliEngine({ binary: process.execPath });
  await assert.rejects(
    () => cli.loginJwt({
      clientId: "client",
      privateKey: "key",
      username: "user",
      instanceUrl: "http://example.invalid",
      alias: "target"
    }),
    /must use HTTPS/
  );
});
