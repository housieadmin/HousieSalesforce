import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { queryBigObject } from "../src/query-big-object.js";

test("reads JSON records produced by Salesforce Bulk API", () => {
  const rows = [{ Id: "one" }, { Id: "two" }];
  const result = queryBigObject("SELECT Id FROM Example__b", {
    targetOrg: "target", projectRoot: process.cwd(),
    run(command, args) {
      const output = args[args.indexOf("--output-file") + 1];
      fs.writeFileSync(output, JSON.stringify(rows));
      return Buffer.from("");
    }
  });
  assert.deepEqual(result, rows);
});
test("rejects missing Salesforce context", () => {
  assert.throws(() => queryBigObject("SELECT Id FROM Example__b", { projectRoot: process.cwd() }), /targetOrg is required/);
});
