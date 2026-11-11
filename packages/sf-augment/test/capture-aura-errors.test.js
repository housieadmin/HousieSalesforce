import test from "node:test";
import assert from "node:assert/strict";
import { captureAuraErrors } from "../src/capture-aura-errors.js";

test("captures Aura errors and removes its listener", async () => {
  const listeners = new Map();
  const page = { on: (event, fn) => listeners.set(event, fn), off: event => listeners.delete(event) };
  const capture = captureAuraErrors(page);
  listeners.get("response")({
    url: () => "https://example.test/sfsites/aura", request: () => ({ method: () => "POST" }),
    status: () => 500, text: async () => JSON.stringify({ actions: [{ state: "ERROR", error: [{ message: "Invalid request" }] }] })
  });
  const [entry] = await capture.snapshot();
  assert.equal(entry.status, 500);
  assert.ok(entry.errors.some(value => value.includes("Invalid request")));
  capture.stop();
  assert.equal(listeners.has("response"), false);
});
