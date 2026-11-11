import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function collectApexLogs({ targetOrg, artifactDir = process.env.E2E_ARTIFACT_DIR || "artifacts/e2e" } = {}) {
  const directory = path.join(artifactDir, "apex-logs");
  fs.mkdirSync(directory, { recursive: true });
  const result = spawnSync("sf", ["apex", "log", "get", "--number", "20", "--output-dir", directory, "--target-org", targetOrg], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
  });
  const output = [result.stdout, result.stderr].map(value => String(value || "")).filter(Boolean).join("\n");
  fs.writeFileSync(path.join(directory, "fetch-output.txt"), output);
  if (result.status !== 0) fs.writeFileSync(path.join(directory, "collection-error.txt"), "Apex log retrieval failed.");
  const count = fs.readdirSync(directory, { withFileTypes: true }).filter(entry => entry.isFile() && entry.name.endsWith(".log")).length;
  fs.appendFileSync(path.join(artifactDir, "summary.md"), "\nApex debug logs collected: " + count + "\n");
  return { count, status: result.status ?? 1 };
}
