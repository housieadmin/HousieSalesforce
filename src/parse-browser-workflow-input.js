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
  return { ref, scenarios, description: String(description || "E2E verification").replace(/[\r\n]/g, " ").slice(0, 300) };
}
