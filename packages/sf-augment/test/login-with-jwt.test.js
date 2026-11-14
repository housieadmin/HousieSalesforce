import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { loginWithJwt } from "../src/login-with-jwt.js";

test("writes a private temporary key, invokes Salesforce CLI and removes the key", () => {
  let args;
  let options;
  let keyPath;
  loginWithJwt({
    clientId: "client", username: "user", instanceUrl: "https://example.my.salesforce.com",
    jwtKey: "private-key", alias: "target", setDefault: true,
    env: { SF_JWT_KEY: "private-key", KEEP: "yes" },
    run(command, actualArgs, actualOptions) {
      assert.equal(command, "sf");
      args = actualArgs; options = actualOptions; keyPath = actualArgs[actualArgs.indexOf("--jwt-key-file") + 1];
      assert.equal(fs.readFileSync(keyPath, "utf8"), "private-key");
      assert.equal(fs.statSync(keyPath).mode & 0o777, 0o600);
      return { status: 0 };
    }
  });
  assert.ok(args.includes("--set-default"));
  assert.equal(options.env.SF_JWT_KEY, undefined);
  assert.equal(options.env.KEEP, "yes");
  assert.equal(fs.existsSync(keyPath), false);
});

test("rejects missing credentials and reports CLI failure without exposing secrets", () => {
  assert.throws(() => loginWithJwt({ jwtKey: "secret" }), /clientId is required/);
  assert.throws(() => loginWithJwt({
    clientId: "client", username: "user", instanceUrl: "https://example.test",
    jwtKey: "secret", alias: "target", run: () => ({ status: 1 })
  }), /authentication failed/);
});
