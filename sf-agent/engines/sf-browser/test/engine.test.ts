import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { SfBrowserEngine } from "../index.js";

test("runs an independent browser session and captures a page", async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><html><head><title>sf-browser-smoke</title></head><body>ready</body></html>");
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind a TCP port.");

  const browser = new SfBrowserEngine({ headless: true });
  try {
    await browser.goto(`http://127.0.0.1:${address.port}/`);
    assert.equal(await browser.getPage().title(), "sf-browser-smoke");
    const screenshot = await browser.screenshot("smoke");
    assert.ok(screenshot.byteLength > 0);
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("rejects non-HTTP navigation protocols", async () => {
  const browser = new SfBrowserEngine({ baseUrl: "https://example.invalid" });
  await assert.rejects(() => browser.goto("javascript:alert(1)"), /HTTP and HTTPS/);
  await browser.close();
});
