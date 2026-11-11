import { execFileSync } from "node:child_process";
import fs from "node:fs";

const parseJson = raw => {
  const clean = String(raw).replace(/\u001b\[[0-9;]*m/g, "").trim();
  const start = clean.indexOf("{");
  if (start < 0) throw new Error("Salesforce CLI returned no JSON.");
  try { return JSON.parse(clean.slice(start)); }
  catch { throw new Error("Salesforce CLI returned invalid JSON."); }
};
const run = args => parseJson(execFileSync("sf", [...args, "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));

export function enableApexTrace({ username, targetOrg, writeEnv = value => process.env.GITHUB_ENV && fs.appendFileSync(process.env.GITHUB_ENV, value + "\n") }) {
  if (!username) throw new Error("SF_USERNAME is required.");
  const literal = String(username).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const query = "SELECT Id FROM User WHERE Username = '" + literal + "' LIMIT 1";
  const userId = run(["data", "query", "--query", query, "--target-org", targetOrg]).result?.records?.[0]?.Id;
  if (!/^005[A-Za-z0-9]{12,15}$/.test(userId || "")) throw new Error("Could not resolve authenticated Salesforce user ID.");
  const flags = run(["apex", "trace", "list", "--target-org", targetOrg]).result || [];
  const existing = flags.find(item => (item.tracedEntityId || item.TracedEntityId) === userId);
  if (existing) run(["apex", "trace", "delete", "--trace-flag-id", existing.id || existing.Id, "--target-org", targetOrg]);
  run(["apex", "trace", "create", "--traced-entity-id", userId, "--debug-level", "SFDC_DevConsole", "--duration", "45", "--target-org", targetOrg]);
  writeEnv("APEX_DEBUG_ENABLED=true");
  return userId;
}
