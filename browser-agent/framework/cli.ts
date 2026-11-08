import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./config";
import { runDefinition } from "./runner";
import type { ScenarioDefinition, WorkflowDefinition } from "./scenario";

async function main() {
  const files = process.argv.slice(2).filter(value => !value.startsWith("--"));
  if (!files.length) {
    throw new Error("Usage: npm run browser:scenario -- <scenario-or-workflow.ts> [more files...]");
  }
  const config = loadConfig();
  let failed = false;

  for (const file of files) {
    const absolute = path.resolve(file);
    const module = await import(pathToFileURL(absolute).href);
    const definition = (module.default || module.scenario || module.workflow) as ScenarioDefinition | WorkflowDefinition | undefined;
    if (!definition || !["scenario", "workflow"].includes(definition.kind)) {
      throw new Error(file + " must default-export defineScenario(...) or defineWorkflow(...).");
    }
    const result = await runDefinition(definition, config);
    process.stdout.write(JSON.stringify({ file, ...result }) + "\n");
    if (result.status === "failed") failed = true;
  }
  if (failed) process.exitCode = 1;
}

main().catch(error => {
  process.stderr.write((error instanceof Error ? error.stack : String(error)) + "\n");
  process.exitCode = 1;
});
