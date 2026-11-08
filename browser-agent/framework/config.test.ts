import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "./config";

test("loads project URLs and browser settings from JSON with environment interpolation", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "browser-agent-config-"));
  const file = path.join(dir, "config.json");
  const previous = process.env.BROWSER_AGENT_BASE_URL;
  process.env.BROWSER_AGENT_BASE_URL = "https://override.example.com";
  fs.writeFileSync(file, JSON.stringify({
    baseUrl: "${BROWSER_AGENT_BASE_URL}",
    startUrl: "https://org.example.com/secur/frontdoor.jsp?sid=example",
    browser: { headless: false, slowMo: 10, viewport: { width: 1280, height: 800 } },
    project: { route: "/lightning/page/home" }
  }));
  try {
    const config = loadConfig(file);
    assert.equal(config.baseUrl, "https://override.example.com");
    assert.equal(config.startUrl, "https://org.example.com/secur/frontdoor.jsp?sid=example");
    assert.equal(config.headless, false);
    assert.equal(config.slowMo, 10);
    assert.deepEqual(config.viewport, { width: 1280, height: 800 });
    assert.deepEqual(config.project, { route: "/lightning/page/home" });
  } finally {
    if (previous === undefined) delete process.env.BROWSER_AGENT_BASE_URL;
    else process.env.BROWSER_AGENT_BASE_URL = previous;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("rejects non-HTTP project base URLs", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "browser-agent-config-"));
  const file = path.join(dir, "config.json");
  fs.writeFileSync(file, JSON.stringify({ baseUrl: "file:///tmp" }));
  try {
    assert.throws(() => loadConfig(file), /baseUrl must use HTTP or HTTPS/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
