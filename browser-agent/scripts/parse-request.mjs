// Regression coverage linked to failed execution: https://github.com/housieadmin/HousieSalesforce/actions/runs/41621170023
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function parseRequest(body) {
  const lines = String(body || '').split(/\r?\n/).map((line) => line.trim());
  if (lines[0] !== '/browser-agent run') throw new Error('Invalid command');
  const ref = (lines.find((line) => line.startsWith('ref:')) || '').slice(4).trim();
  if (!ref || ref.length > 200 || ref.startsWith('-') || ref.includes('..') || !/^[A-Za-z0-9._/-]+$/.test(ref)) throw new Error('Invalid ref');
  execFileSync('git', ['check-ref-format', '--branch', ref], { stdio: 'ignore' });
  const start = lines.indexOf('scenarios:');
  if (start < 0) throw new Error('Missing scenarios section');
  const scenarios = [];
  for (const line of lines.slice(start + 1)) {
    if (!line) continue;
    if (!line.startsWith('- ')) break;
    const file = line.slice(2).trim();
    if (!/^browser-agent\/scenarios\/[A-Za-z0-9._/-]+\.spec\.ts$/.test(file) || file.includes('..') || file.includes('//')) throw new Error('Invalid scenario path: ' + file);
    scenarios.push(file);
  }
  if (!scenarios.length || scenarios.length > 10 || new Set(scenarios).size !== scenarios.length) throw new Error('Supply 1-10 unique scenario files');
  const description = (lines.find((line) => line.startsWith('description:')) || 'description: AI-requested browser execution').slice(12).trim().replace(/[\r\n]/g, ' ').slice(0, 300);
  return { ref, description, scenarios };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const request = parseRequest(process.env.COMMENT_BODY);
  if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `ref=${request.ref}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `description=${request.description}\n`);
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `scenarios=${JSON.stringify(request.scenarios)}\n`);
}
