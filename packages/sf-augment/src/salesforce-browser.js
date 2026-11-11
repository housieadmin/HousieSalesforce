import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const required = (value, name) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
  return value.trim();
};

function parseCliJson(raw, description) {
  const clean = raw.replace(/\u001b\[[0-9;]*m/g, "").trim();
  const start = clean.indexOf("{");
  if (start < 0) throw new Error(`Salesforce CLI did not return JSON for ${description}.`);
  try {
    return JSON.parse(clean.slice(start));
  } catch {
    throw new Error(`Salesforce CLI returned invalid JSON for ${description}.`);
  }
}

export function extractFrontdoorUrl(raw) {
  const result = parseCliJson(String(raw), "the frontdoor URL");
  const url = result?.result?.url;
  if (typeof url !== "string" || !/^https:\/\//.test(url)) {
    throw new Error("Salesforce CLI did not return a valid frontdoor URL.");
  }
  return url;
}

export function getFrontdoorUrl({ targetOrg, projectRoot, lightningPath, timeout = 60000 } = {}) {
  const alias = required(targetOrg, "targetOrg");
  const cwd = required(projectRoot, "projectRoot");
  const args = ["org", "open", "--url-only"];
  if (lightningPath !== undefined) {
    if (typeof lightningPath !== "string" || !lightningPath.startsWith("/lightning/")) {
      throw new Error("Expected a Lightning route beginning with /lightning/.");
    }
    args.push("--path", lightningPath);
  }
  args.push("--target-org", alias, "--json");
  const output = execFileSync("sf", args, { cwd, encoding: "utf8", timeout });
  return extractFrontdoorUrl(output);
}

export async function openLightningTab(page, lightningPath, {
  targetOrg,
  projectRoot,
  timeout = 60000
} = {}) {
  if (typeof lightningPath !== "string" || !lightningPath.startsWith("/lightning/")) {
    throw new Error("Expected a Lightning route beginning with /lightning/.");
  }
  const url = getFrontdoorUrl({ targetOrg, projectRoot, lightningPath, timeout });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout }).catch(error => {
    if (!String(error).includes("ERR_ABORTED")) throw error;
  });
}

export function captureAuraErrors(page, { maxEntries = 100 } = {}) {
  if (!page || typeof page.on !== "function" || typeof page.off !== "function") {
    throw new Error("A Playwright-compatible page is required.");
  }
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error("maxEntries must be a positive integer.");
  }
  const pending = [];
  const onResponse = response => {
    if (!/\/sfsites\/aura(?:\?|$)/.test(response.url()) || response.request().method() !== "POST") return;
    const capture = (async () => {
      const entry = { status: response.status(), errors: [] };
      try {
        const payload = JSON.parse(await response.text());
        const visit = value => {
          if (!value || typeof value !== "object") return;
          if (Array.isArray(value)) { value.forEach(visit); return; }
          for (const [key, candidate] of Object.entries(value)) {
            if (["message", "exceptionMessage", "errorCode", "state"].includes(key) &&
              typeof candidate === "string" &&
              /error|exception|fail|invalid|denied|not enough|limit|required/i.test(candidate)) {
              entry.errors.push(key + ": " + candidate.slice(0, 1200));
            }
            visit(candidate);
          }
        };
        visit(payload);
      } catch (error) {
        entry.errors.push("Unable to parse Aura response: " + String(error).slice(0, 250));
      }
      return entry;
    })();
    pending.push(capture);
    if (pending.length > maxEntries) pending.shift();
  };
  page.on("response", onResponse);
  return {
    async snapshot() { return Promise.all(pending); },
    stop() { page.off("response", onResponse); }
  };
}

export function queryBigObject(soql, {
  targetOrg,
  projectRoot,
  apiVersion = "66.0",
  timeout = 180000
} = {}) {
  const query = required(soql, "soql");
  const alias = required(targetOrg, "targetOrg");
  const cwd = required(projectRoot, "projectRoot");
  const version = required(apiVersion, "apiVersion");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sf-augment-bigobject-"));
  const outputFile = path.join(directory, "records.json");
  try {
    try {
      execFileSync("sf", [
        "data", "export", "bulk",
        "--query", query,
        "--target-org", alias,
        "--output-file", outputFile,
        "--result-format", "json",
        "--wait", "5",
        "--api-version", version,
        "--json"
      ], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024, timeout });
    } catch (error) {
      const failure = error;
      const detail = [failure.stderr, failure.stdout, failure.message]
        .map(value => String(value ?? ""))
        .filter(Boolean)
        .join("\n")
        .replace(/\u001b\[[0-9;]*m/g, "")
        .replace(/[a-f0-9]{32}/gi, "[REDACTED_ID_OR_KEY]")
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
        .slice(0, 1200);
      throw new Error("Salesforce Bulk API 2.0 Big Object query failed. " + detail);
    }
    const raw = fs.readFileSync(outputFile, "utf8").replace(/^\uFEFF/, "").trim();
    if (!raw) return [];
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      try { parsed = raw.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)); }
      catch { throw new Error("Salesforce Bulk API 2.0 returned an invalid JSON result file."); }
    }
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.records)) return parsed.records;
    throw new Error("Salesforce Bulk API 2.0 result file did not contain a record array.");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
