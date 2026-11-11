import test from "node:test";
import assert from "node:assert/strict";
import { captureBrowserDiagnostics } from "./browser-diagnostics.js";

test("records browser failures and redacts credential query parameters", () => {
  const listeners = new Map();
  const page = {
    on(event, listener) { listeners.set(event, listener); },
    off(event) { listeners.delete(event); }
  };
  const diagnostics = captureBrowserDiagnostics(page);
  listeners.get("console")({ type: () => "error", text: () => "console failure" });
  listeners.get("pageerror")({ message: "uncaught page error" });
  listeners.get("requestfailed")({
    failure: () => ({ errorText: "net::ERR_FAILED" }),
    url: () => "https://example.test/path?sid=secret",
    method: () => "GET"
  });
  listeners.get("response")({
    status: () => 403,
    url: () => "https://example.test/path?access_token=secret",
    request: () => ({ method: () => "POST" })
  });
  diagnostics.note("scenario context");
  const events = diagnostics.snapshot();
  assert.equal(events.length, 5);
  assert.ok(events[2].url.includes("sid=%5BREDACTED%5D"));
  assert.ok(events[3].url.includes("access_token=%5BREDACTED%5D"));
  assert.equal(events[4].type, "scenario-note");
  diagnostics.stop();
  assert.equal(listeners.size, 0);
});

test("limits retained diagnostics", () => {
  const listeners = new Map();
  const page = { on(event, listener) { listeners.set(event, listener); }, off(event) { listeners.delete(event); } };
  const diagnostics = captureBrowserDiagnostics(page, { maxEvents: 2 });
  diagnostics.note("one");
  diagnostics.note("two");
  diagnostics.note("three");
  assert.deepEqual(diagnostics.snapshot().map(event => event.message), ["two", "three"]);
  diagnostics.stop();
});
