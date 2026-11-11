import fs from "node:fs";
import { execFileSync } from "node:child_process";

export function parseBrowserRequest(body) {
  const lines = String(body || "").split(/\r?\n/).map(line => line.trim());
  if (lines.shift() !== "/e2e run") throw new Error("Invalid E2E command.");
  const ref = (lines.find(line => line.startsWith("ref:")) || "").slice(4).trim();
  if (!ref || ref.length > 200 || ref.startsWith("-") || ref.includes("..") || !/^[A-Za-z0-9._/-]+$/.test(ref)) {
    throw new Error("Invalid source ref.");
  }
  execFileSync("git", ["check-ref-format", "--branch", ref], { stdio: "ignore" });
  const start = lines.indexOf("scenarios:");
  if (start < 0) throw new Error("Missing scenarios section.");
  const scenarios = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("- ")) scenarios.push(line.slice(2).trim());
    else if (line.startsWith("description:")) break;
    else if (line) throw new Error("Invalid scenario list.");
  }
  validateScenarios(scenarios);
  const description = (lines.find(line => line.startsWith("description:")) || "description: E2E verification").slice(12).trim().slice(0, 300);
  return { ref, scenarios, description };
}

export function validateScenarios(scenarios) {
  if (!Array.isArray(scenarios) || scenarios.length < 1 || scenarios.length > 10 ||
    new Set(scenarios).size !== scenarios.length ||
    scenarios.some(file => typeof file !== "string" || !/^tests\/e2e\/[A-Za-z0-9._/-]+\.spec\.ts$/.test(file) ||
      file.includes("..") || file.includes("//"))) {
    throw new Error("Provide 1-10 unique test files under tests/e2e/.");
  }
}

export function writeBrowserRequestOutput(request, file = process.env.GITHUB_OUTPUT) {
  if (!file) return;
  fs.appendFileSync(file, [
    "ref=" + request.ref,
    "description=" + request.description,
    "scenarios=" + JSON.stringify(request.scenarios)
  ].join("\n") + "\n");
}
