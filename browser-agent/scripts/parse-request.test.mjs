// Regression coverage for failed run:
// https://github.com/housieadmin/HousieSalesforce/actions/runs/41622056652
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRequest } from './parse-request.mjs';

const valid = '/browser-agent run\nref: test/account-record-browser-check-2\nscenarios:\n- browser-agent/scenarios/inspect-housie-account.spec.ts\ndescription: inspect account';

test('parses LF-delimited issue comments', () => {
  const result = parseRequest(valid);
  assert.equal(result.ref, 'test/account-record-browser-check-2');
  assert.deepEqual(result.scenarios, ['browser-agent/scenarios/inspect-housie-account.spec.ts']);
  assert.equal(result.description, 'inspect account');
});

test('parses CRLF-delimited issue comments', () => {
  const result = parseRequest(valid.replace(/\n/g, '\r\n'));
  assert.equal(result.ref, 'test/account-record-browser-check-2');
  assert.equal(result.scenarios.length, 1);
});

test('accepts independent framework scenarios and workflows', () => {
  const request = valid.replace('inspect-housie-account.spec.ts', 'capture-org-home.scenario.ts')
    .replace('description: inspect account', '- browser-agent/scenarios/org-inspection.workflow.ts\ndescription: inspect account');
  assert.deepEqual(parseRequest(request).scenarios, [
    'browser-agent/scenarios/capture-org-home.scenario.ts',
    'browser-agent/scenarios/org-inspection.workflow.ts'
  ]);
});

test('rejects invalid command', () => {
  assert.throws(() => parseRequest('hello\n' + valid.split('\n').slice(1).join('\n')), /Invalid command/);
});

test('rejects traversal scenario paths', () => {
  assert.throws(() => parseRequest(valid.replace('inspect-housie-account.spec.ts', '../escape.spec.ts')), /Invalid scenario path/);
});

test('rejects duplicate scenarios before the description', () => {
  const duplicate = valid.replace(
    'description: inspect account',
    '- browser-agent/scenarios/inspect-housie-account.spec.ts\ndescription: inspect account'
  );
  assert.throws(() => parseRequest(duplicate), /1-10 unique/);
});

import { extractFrontdoorUrl } from './extract-frontdoor-url.mjs';

test('extracts Salesforce frontdoor URL from CLI JSON', () => {
  const url = 'https://example.my.salesforce.com/secur/frontdoor.jsp?sid=masked';
  assert.equal(extractFrontdoorUrl(JSON.stringify({ status: 0, result: { url } })), url);
});

test('extracts JSON when Salesforce CLI writes a warning before it', () => {
  const url = 'https://example.my.salesforce.com/secur/frontdoor.jsp?sid=masked';
  assert.equal(extractFrontdoorUrl('Warning: generated login URL\n' + JSON.stringify({ result: { url } })), url);
});

test('rejects malformed Salesforce CLI JSON', () => {
  assert.throws(() => extractFrontdoorUrl('not json'), /did not return JSON/);
  assert.throws(() => extractFrontdoorUrl('{broken'), /invalid JSON/);
});

test('rejects missing or non-HTTPS frontdoor URL', () => {
  assert.throws(() => extractFrontdoorUrl(JSON.stringify({ result: {} })), /valid result.url/);
  assert.throws(() => extractFrontdoorUrl(JSON.stringify({ result: { url: 'http://example.com' } })), /valid result.url/);
});

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('frontdoor parser CLI works when invoked with a relative script path', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frontdoor-parser-'));
  const input = path.join(dir, 'cli-output.json');
  const url = 'https://example.my.salesforce.com/secur/frontdoor.jsp?sid=masked';
  fs.writeFileSync(input, JSON.stringify({ result: { url } }));
  try {
    const result = spawnSync(process.execPath, ['browser-agent/scripts/extract-frontdoor-url.mjs', input], {
      cwd: process.cwd(),
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, url);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
