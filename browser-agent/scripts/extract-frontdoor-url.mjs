import fs from 'node:fs';

export function extractFrontdoorUrl(raw) {
  const start = raw.indexOf('{');
  if (start < 0) throw new Error('Salesforce CLI did not return JSON from sf org open.');
  let data;
  try {
    data = JSON.parse(raw.slice(start));
  } catch {
    throw new Error('Salesforce CLI returned invalid JSON from sf org open.');
  }
  const url = data?.result?.url;
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error('Salesforce CLI JSON did not contain a valid result.url.');
  }
  return url;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const raw = fs.readFileSync(process.argv[2], 'utf8');
  process.stdout.write(extractFrontdoorUrl(raw));
}
