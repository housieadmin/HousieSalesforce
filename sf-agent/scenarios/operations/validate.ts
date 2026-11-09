import { defineScenario } from "@sf-agent/core";
import type { SfCliEngine } from "@sf-agent/sf-cli";
import type { ProjectTools } from "../../plugins/project-tools.js";

export default defineScenario({
  name: "validate",
  async run(context) {
    const cli = context.engine<SfCliEngine>("sf-cli");
    const tools = context.utility<ProjectTools>("project-tools");
    const targetOrg = String(context.inputs.targetOrg ?? "");
    const sourceDirs = context.inputs.sourcePaths
      ? await tools.resolveSourcePaths(context.inputs.sourcePaths)
      : undefined;
    const manifest = context.inputs.manifest
      ? await tools.resolveManifest(context.inputs.manifest)
      : undefined;
    const result = await cli.deploy({ targetOrg, sourceDirs, manifest, dryRun: true, testLevel: "NoTestRun" });
    return { validation: "completed", output: result.stdout.slice(-3000) };
  }
});
