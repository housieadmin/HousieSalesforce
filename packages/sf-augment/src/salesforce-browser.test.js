import test from "node:test";
import assert from "node:assert/strict";
import { captureAuraErrors, extractFrontdoorUrl, openLightningTab, queryBigObject } from "./salesforce-browser.js";

test("captures concise Aura errors and can stop listening", async () => {
  const listeners = new Map();
  const page = {
    on(event, listener) { listeners.set(event, listener); },
    off(event) { listeners.delete(event); }
  };
  const capture = captureAuraErrors(page);
  const response = {
    url: () => "https://example.my.salesforce.com/sfsites/aura",
    request: () => ({ method: () => "POST" }),
    status: () => 500,
    text: async () => JSON.stringify({ actions: [{ state: "ERROR", error: [{ message: "Invalid request" }] }] })
  };
  listeners.get("response")(response);
  const [entry] = await capture.snapshot();
  assert.equal(entry.status, 500);
  assert.ok(entry.errors.some(value => value.includes("Invalid request")));
  capture.stop();
  assert.equal(listeners.has("response"), false);
});

test("rejects non-Lightning routes before invoking Salesforce CLI", async () => {
  await assert.rejects(
    openLightningTab({ goto: async () => {} }, "/apex/SomePage", { targetOrg: "target", projectRoot: process.cwd() }),
    /Lightning route/
  );
});

test("requires explicit project configuration for Big Object queries", () => {
  assert.throws(() => queryBigObject("SELECT Id FROM Example__b", { projectRoot: process.cwd() }), /targetOrg is required/);
});

test("extracts a frontdoor URL from Salesforce CLI JSON", () => {
  assert.equal(extractFrontdoorUrl('info\\n{"result":{"url":"https://example.my.salesforce.com/frontdoor"}}'), "https://example.my.salesforce.com/frontdoor");
});

test("rejects invalid frontdoor output", () => {
  assert.throws(() => extractFrontdoorUrl('{"result":{"url":"javascript:alert(1)"}}'), /valid frontdoor URL/);
});
