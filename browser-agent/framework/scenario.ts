import type { Page } from "@playwright/test";
import type { BrowserAgentConfig } from "./config";

export interface ScenarioContext {
  page: Page;
  config: BrowserAgentConfig;
  navigate(pathOrUrl: string): Promise<void>;
  screenshot(name: string): Promise<string>;
  log(message: string, details?: Record<string, unknown>): void;
  note(message: string): void;
}

export interface ScenarioDefinition {
  kind: "scenario";
  id: string;
  description?: string;
  run(context: ScenarioContext): Promise<void>;
}

export interface WorkflowDefinition {
  kind: "workflow";
  id: string;
  description?: string;
  scenarios: ScenarioDefinition[];
}

export function defineScenario(definition: Omit<ScenarioDefinition, "kind">): ScenarioDefinition {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(definition.id)) {
    throw new Error("Scenario id must be a short, filesystem-safe identifier.");
  }
  if (typeof definition.run !== "function") throw new Error("Scenario run(context) is required.");
  return Object.freeze({ ...definition, kind: "scenario" as const });
}

/** A workflow is an ordered list of scenario definitions; scenario logic is never copied. */
export function defineWorkflow(definition: Omit<WorkflowDefinition, "kind">): WorkflowDefinition {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(definition.id)) {
    throw new Error("Workflow id must be a short, filesystem-safe identifier.");
  }
  if (!definition.scenarios.length) throw new Error("A workflow must contain at least one scenario.");
  if (definition.scenarios.some(item => item.kind !== "scenario")) {
    throw new Error("Workflows may compose scenario definitions only.");
  }
  return Object.freeze({ ...definition, scenarios: [...definition.scenarios], kind: "workflow" as const });
}
