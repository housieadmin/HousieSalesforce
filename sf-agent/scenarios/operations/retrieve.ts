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
    const manifest = await tools.resolveManifest(context.inputs.manifest ?? "manifest/package-retrieve.xml");
    const outputDir = await tools.resolveOutputDirectory(context.inputs.outputDirectory);
    const result = await cli.retrieve({ targetOrg, manifest, outputDir });
    return { retrieval: "completed", output: result.stdout.slice(-3000), outputDir: outputDir ?? null };
  }
});
