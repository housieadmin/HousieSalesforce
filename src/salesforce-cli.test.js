import test from "node:test";
import assert from "node:assert/strict";
import { buildJwtLoginArgs } from "./salesforce-cli.js";

test("builds JWT login arguments from supplied project configuration", () => {
  assert.deepEqual(buildJwtLoginArgs({
    clientId: "client",
    username: "developer@example.test",
    instanceUrl: "https://example.my.salesforce.com",
    jwtKeyFile: "/tmp/key",
    alias: "target"
  }), [
    "org", "login", "jwt",
    "--client-id", "client",
    "--jwt-key-file", "/tmp/key",
    "--username", "developer@example.test",
    "--instance-url", "https://example.my.salesforce.com",
    "--alias", "target",
    "--json"
  ]);
});

test("supports setting the authenticated org as default", () => {
  const args = buildJwtLoginArgs({ clientId: "client", username: "user", instanceUrl: "https://example.my.salesforce.com", jwtKeyFile: "/tmp/key", alias: "target", setDefault: true });
  assert.equal(args.at(-1), "--set-default");
});

test("rejects missing configuration", () => {
  assert.throws(() => buildJwtLoginArgs({
    clientId: "client",
    username: "user",
    instanceUrl: "https://example.my.salesforce.com",
    jwtKeyFile: "/tmp/key"
  }), /alias is required/);
});
