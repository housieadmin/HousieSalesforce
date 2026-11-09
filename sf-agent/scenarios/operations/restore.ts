import { defineScenario } from "@sf-agent/core";
import type { SfCliEngine } from "@sf-agent/sf-cli";
import type { ProjectTools } from "../../plugins/project-tools.js";

export default defineScenario({
  name: "restore",
  async run(context) {
    const cli = context.engine<SfCliEngine>("sf-cli");
    const tools = context.utility<ProjectTools>("project-tools");
    tools.requireConfirmation(context.inputs.confirmation, "RESTORE");
    const targetOrg = tools.requireTargetOrg(context.inputs.targetOrg);
    const sourceDirs = await tools.resolveSourcePaths(context.inputs.sourcePaths);
    const deployment = await cli.deploy({ targetOrg, sourceDirs, testLevel: "NoTestRun" });

    if (context.inputs.runLocalTests === true) {
      await cli.runApexTests({ targetOrg, testLevel: "RunLocalTests" });
    }
    return { restore: "completed", output: deployment.stdout.slice(-3000) };
  }
});
