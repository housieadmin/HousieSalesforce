import test from "node:test";
import assert from "node:assert/strict";
import { enableApexTrace, escapeSoqlLiteral, extractUserId, findTraceId } from "./apex-logs.mjs";

test("escapes SOQL string literals", () => {
  assert.equal(escapeSoqlLiteral("a\\b'c"), "a\\\\b\\'c");
});

test("extracts Salesforce user and trace IDs", () => {
  const userId = "005000000000001AAA";
  assert.equal(extractUserId({ result: { records: [{ Id: userId }] } }), userId);
  assert.equal(findTraceId({ result: [{ Id: "7tf1", TracedEntityId: userId }] }, userId), "7tf1");
  assert.throws(() => extractUserId({ result: { records: [] } }), /user ID/);
});

test("enables tracing through the supplied Salesforce CLI adapter", () => {
  const calls = [];
  const userId = "005000000000001AAA";
  const result = enableApexTrace({
    username: "dev@example.test",
    run(args) {
      calls.push(args);
      if (args[0] === "data") return { result: { records: [{ Id: userId }] } };
      if (args[1] === "trace" && args[2] === "list") return { result: [{ Id: "7tf1", TracedEntityId: userId }] };
      return { result: {} };
    },
    writeEnv(value) { calls.push(["env", value]); }
  });
  assert.equal(result, userId);
  assert.equal(calls.filter(call => call[0] === "apex" && call[2] === "delete").length, 1);
  assert.deepEqual(calls.at(-1), ["env", "APEX_DEBUG_ENABLED=true"]);
});
