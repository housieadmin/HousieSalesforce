import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export function escapeSoqlLiteral(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function parseJson(raw, label) {
  const clean = String(raw).replace(/\u001b\[[0-9;]*m/g, "").trim();
  const start = clean.indexOf("{");
  if (start < 0) throw new Error("Salesforce CLI returned no JSON for " + label);
  try { return JSON.parse(clean.slice(start)); }
  catch { throw new Error("Salesforce CLI returned invalid JSON for " + label); }
}

export function extractUserId(response) {
  const result = response?.result;
  const records = Array.isArray(result) ? result : result?.records;
  const id = records?.[0]?.Id;
  if (typeof id !== "string" || !/^005[A-Za-z0-9]{12,15}$/.test(id)) {
    throw new Error("Could not resolve the authenticated Salesforce user ID.");
  }
  return id;
}

export function findTraceId(response, userId) {
  const result = response?.result;
  const records = Array.isArray(result) ? result : result?.records || [];
  const trace = records.find(item => (item.tracedEntityId || item.TracedEntityId) === userId);
  return trace?.id || trace?.Id || null;
}

const runSf = args => parseJson(execFileSync("sf", [...args, "--json"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  maxBuffer: 8 * 1024 * 1024
}), args.slice(0, 3).join(" "));

export function enableApexTrace({
  username,
  targetOrg = "housie-browser-agent",
  run = runSf,
  writeEnv = value => process.env.GITHUB_ENV && fs.appendFileSync(process.env.GITHUB_ENV, value + "\n")
}) {
  if (typeof username !== "string" || !username.trim()) throw new Error("SF_USERNAME is required.");
  const userQuery = "SELECT Id FROM User WHERE Username = '" + escapeSoqlLiteral(username) + "' LIMIT 1";
  const userId = extractUserId(run(["data", "query", "--query", userQuery, "--target-org", targetOrg]));
  const traceId = findTraceId(run(["apex", "trace", "list", "--target-org", targetOrg]), userId);
  if (traceId) run(["apex", "trace", "delete", "--trace-flag-id", traceId, "--target-org", targetOrg]);
  run(["apex", "trace", "create", "--traced-entity-id", userId, "--debug-level", "SFDC_DevConsole", "--duration", "45", "--target-org", targetOrg]);
  writeEnv("APEX_DEBUG_ENABLED=true");
  return userId;
}

export function collectApexLogs({
  targetOrg = "housie-browser-agent",
  artifactDir = process.env.BROWSER_AGENT_ARTIFACT_DIR || "artifacts/local-run"
} = {}) {
  const logDir = path.join(artifactDir, "apex-logs");
  fs.mkdirSync(logDir, { recursive: true });
  const result = spawnSync("sf", ["apex", "log", "get", "--number", "20", "--output-dir", logDir, "--target-org", targetOrg], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  const output = [result.stdout, result.stderr].map(value => String(value || "")).filter(Boolean).join("\n");
  fs.writeFileSync(path.join(logDir, "fetch-output.txt"), output);
  if (result.status !== 0) {
    fs.writeFileSync(path.join(logDir, "collection-error.txt"), "Apex log retrieval failed with exit code " + (result.status ?? "unknown"));
  }
  const countLogs = directory => fs.readdirSync(directory, { withFileTypes: true }).reduce((count, entry) => {
    const full = path.join(directory, entry.name);
    return count + (entry.isDirectory() ? countLogs(full) : entry.isFile() && entry.name.endsWith(".log") ? 1 : 0);
  }, 0);
  const count = countLogs(logDir);
  const summary = path.join(artifactDir, "summary.md");
  fs.appendFileSync(summary, "\nApex debug logs collected: " + count + "\n");
  return { count, status: result.status ?? 1 };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const action = process.argv[2];
  const targetOrg = process.env.SF_TARGET_ORG_ALIAS || "housie-browser-agent";
  if (action === "enable") {
    enableApexTrace({ username: process.env.SF_USERNAME, targetOrg });
  } else if (action === "collect") {
    collectApexLogs({ targetOrg });
  } else {
    throw new Error("Usage: apex-logs.mjs <enable|collect>");
  }
}
