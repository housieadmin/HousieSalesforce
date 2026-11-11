import test from "node:test";
import assert from "node:assert/strict";
import { openLightningTab } from "../src/open-lightning-tab.js";

test("rejects non-Lightning routes before invoking Salesforce CLI", async () => {
  await assert.rejects(openLightningTab({ goto: async () => {} }, "/apex/Page", {}), /Lightning route/);
});
