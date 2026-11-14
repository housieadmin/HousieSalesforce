import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function queryBigObject(soql, {
  targetOrg, projectRoot, apiVersion = "66.0", timeout = 180000, run = execFileSync
} = {}) {
  if (typeof soql !== "string" || !soql.trim()) throw new Error("soql is required.");
  if (typeof targetOrg !== "string" || !targetOrg.trim()) throw new Error("targetOrg is required.");
  if (typeof projectRoot !== "string" || !projectRoot.trim()) throw new Error("projectRoot is required.");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "sf-augment-bigobject-"));
  const outputFile = path.join(directory, "records.json");
  try {
    try {
      run("sf", [
        "data", "export", "bulk", "--query", soql, "--target-org", targetOrg,
        "--output-file", outputFile, "--result-format", "json", "--wait", "5",
        "--api-version", String(apiVersion), "--json"
      ], { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024, timeout });
    } catch (error) {
      const detail = [error.stderr, error.stdout, error.message].map(value => String(value ?? ""))
        .filter(Boolean).join("\n").replace(/\u001b\[[0-9;]*m/g, "")
        .replace(/[a-f0-9]{32}/gi, "[REDACTED_ID_OR_KEY]")
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]").slice(0, 1200);
      throw new Error("Salesforce Bulk API 2.0 Big Object query failed. " + detail);
    }
    const raw = fs.readFileSync(outputFile, "utf8").replace(/^\uFEFF/, "").trim();
    if (!raw) return [];
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch {
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
