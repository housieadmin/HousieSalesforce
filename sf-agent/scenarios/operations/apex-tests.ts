import { defineScenario } from "@sf-agent/core";
import type { SfCliEngine } from "@sf-agent/sf-cli";
import type { ProjectTools } from "../../plugins/project-tools.js";

export default defineScenario({
  name: "apex-tests",
  async run(context) {
    const cli = context.engine<SfCliEngine>("sf-cli");
    const tools = context.utility<ProjectTools>("project-tools");
    const targetOrg = tools.requireTargetOrg(context.inputs.targetOrg);
    const testMode = String(context.inputs.testMode ?? "local");

    if (testMode === "specified") {
      const classes = tools.validateApexClasses(context.inputs.apexTestClasses);
      const result = await cli.runApexTests({ targetOrg, testLevel: "RunSpecifiedTests", classes });
      return { tests: "completed", mode: testMode, output: result.stdout.slice(-3000) };
    }
    if (testMode !== "local") throw new Error("testMode must be local or specified.");

    const result = await cli.runApexTests({ targetOrg, testLevel: "RunLocalTests" });
    return { tests: "completed", mode: testMode, output: result.stdout.slice(-3000) };
  }
});
