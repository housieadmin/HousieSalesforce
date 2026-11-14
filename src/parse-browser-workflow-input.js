import { validateScenarios } from "./parse-browser-request.js";

export function parseBrowserWorkflowInput({ requestedRef, scenariosJson, description = "" }) {
  const ref = String(requestedRef || "").trim();
  if (!ref || ref.length > 200 || ref.startsWith("-") || ref.includes("..") || !/^[A-Za-z0-9._/-]+$/.test(ref)) {
    throw new Error("Invalid source ref.");
  }
  let scenarios;
  try { scenarios = JSON.parse(String(scenariosJson || "")); }
  catch { throw new Error("Scenario list must be valid JSON."); }
  validateScenarios(scenarios);
  return { ref, scenarios, description: String(description || "browser-test verification").replace(/[\r\n]/g, " ").slice(0, 300) };
}

if (process.argv[1]?.endsWith("/parse-browser-workflow-input.js")) {
  const request = parseBrowserWorkflowInput({
    requestedRef: process.env.REQUESTED_REF,
    scenariosJson: process.env.SCENARIOS_JSON,
    description: process.env.RUN_DESCRIPTION
  });
  if (process.env.GITHUB_OUTPUT) {
    const fs = await import("node:fs");
    fs.appendFileSync(process.env.GITHUB_OUTPUT, [
      "ref=" + request.ref,
      "description=" + request.description,
      "scenarios=" + JSON.stringify(request.scenarios)
    ].join("\n") + "\n");
  }
}
