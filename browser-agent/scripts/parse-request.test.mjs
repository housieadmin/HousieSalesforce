// Regression coverage for the browser-agent request parser.
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
