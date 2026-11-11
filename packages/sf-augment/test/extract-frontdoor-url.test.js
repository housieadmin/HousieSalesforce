import test from "node:test";
import assert from "node:assert/strict";
import { extractFrontdoorUrl } from "../src/extract-frontdoor-url.js";

test("extracts an HTTPS frontdoor URL from CLI output", () => {
  assert.equal(extractFrontdoorUrl('notice\n{"result":{"url":"https://example.my.salesforce.com/frontdoor"}}'), "https://example.my.salesforce.com/frontdoor");
});
test("rejects malformed JSON and unsafe schemes", () => {
  assert.throws(() => extractFrontdoorUrl("not json"), /did not return JSON/);
  assert.throws(() => extractFrontdoorUrl('{"result":{"url":"javascript:alert(1)"}}'), /HTTPS frontdoor URL/);
});
