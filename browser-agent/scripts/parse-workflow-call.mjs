import fs from "node:fs";
import { fileURLToPath } from "node:url";

export function parseWorkflowCall({ requestedRef, scenariosJson, description = "" }) {
  const ref = String(requestedRef || "").trim();
  if (!ref || ref.length > 200 || ref.startsWith("-") || ref.includes("..") || !/^[A-Za-z0-9._/-]+$/.test(ref)) {
    throw new Error("Invalid source ref");
  }
  let scenarios;
  try { scenarios = JSON.parse(String(scenariosJson || "")); }
  catch { throw new Error("Scenario list must be valid JSON"); }
  if (!Array.isArray(scenarios) || scenarios.length < 1 || scenarios.length > 10 ||
    new Set(scenarios).size !== scenarios.length ||
    scenarios.some(file => typeof file !== "string" ||
      !/^browser-agent\/scenarios\/[A-Za-z0-9._/-]+\.spec\.ts$/.test(file) ||
      file.includes("..") || file.includes("//"))) {
    throw new Error("Supply 1-10 unique scenario files under browser-agent/scenarios");
  }
  return {
    ref,
    scenarios,
    description: String(description || "Combined deploy and browser verification")
      .replace(/[\r\n]/g, " ").slice(0, 300)
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const request = parseWorkflowCall({
    requestedRef: process.env.REQUESTED_REF,
    scenariosJson: process.env.SCENARIOS_JSON,
    description: process.env.RUN_DESCRIPTION
  });
  if (!process.env.GITHUB_OUTPUT) throw new Error("GITHUB_OUTPUT is required");
  fs.appendFileSync(process.env.GITHUB_OUTPUT, [
    "ref=" + request.ref,
    "description=" + request.description,
    "scenarios=" + JSON.stringify(request.scenarios)
  ].join("\n") + "\n");
}
