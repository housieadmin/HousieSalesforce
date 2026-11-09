import { defineScenario } from "@sf-agent/core";
import type { SfCliEngine } from "@sf-agent/sf-cli";
import type { ProjectTools } from "../../plugins/project-tools.js";

export default defineScenario({
  name: "retrieve",
  async run(context) {
    const cli = context.engine<SfCliEngine>("sf-cli");
    const tools = context.utility<ProjectTools>("project-tools");
    tools.requireConfirmation(context.inputs.confirmation, "SYNC");
    const targetOrg = tools.requireTargetOrg(context.inputs.targetOrg);

    const sourceDirs = context.inputs.sourcePaths
      ? await tools.resolveSourcePaths(context.inputs.sourcePaths)
      : undefined;
    const manifest = context.inputs.manifest
      ? await tools.resolveManifest(context.inputs.manifest)
      : undefined;
    if (sourceDirs?.length && manifest) {
      throw new Error("Choose sourcePaths or a manifest, not both.");
    }
    if (!sourceDirs?.length && !manifest) {
      throw new Error("Provide sourcePaths or a manifest for retrieval.");
    }

    const outputDir = context.inputs.outputDirectory
      ? await tools.resolveOutputDirectory(context.inputs.outputDirectory)
      : undefined;
    const result = await cli.retrieve({ targetOrg, sourceDirs, manifest, outputDir });
    return { retrieval: "completed", output: result.stdout.slice(-3000), outputDir: outputDir ?? null };
  }
});
