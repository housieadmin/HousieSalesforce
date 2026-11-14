import test from "node:test";
import assert from "node:assert/strict";
import { captureBrowserDiagnostics } from "../src/capture-browser-diagnostics.js";

test("records failures, redacts credentials and stops listeners", () => {
  const listeners = new Map();
  const page = { on: (event, fn) => listeners.set(event, fn), off: event => listeners.delete(event) };
  const diagnostics = captureBrowserDiagnostics(page, { maxEvents: 3 });
  listeners.get("requestfailed")({ failure: () => ({ errorText: "failed" }), url: () => "https://example.test/?sid=secret", method: () => "GET" });
  diagnostics.note("last");
  diagnostics.note("newest");
  const events = diagnostics.snapshot();
  assert.equal(events.length, 3);
  assert.ok(events[0].url.includes("sid=%5BREDACTED%5D"));
  diagnostics.stop();
  assert.equal(listeners.size, 0);
});
