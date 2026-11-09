import { defineScenario } from "@sf-agent/core";
import type { SfCliEngine } from "@sf-agent/sf-cli";
import type { ProjectTools } from "../../plugins/project-tools.js";

export default defineScenario({
  name: "deploy",
  async run(context) {
    const cli = context.engine<SfCliEngine>("sf-cli");
    const tools = context.utility<ProjectTools>("project-tools");
    tools.requireConfirmation(context.inputs.confirmation, "DEPLOY");

    const targetOrg = String(context.inputs.targetOrg ?? "");
    const sourceDirs = context.inputs.sourcePaths
      ? await tools.resolveSourcePaths(context.inputs.sourcePaths)
      : undefined;
    const manifest = context.inputs.manifest
      ? await tools.resolveManifest(context.inputs.manifest)
      : undefined;

    const deployment = await cli.deploy({
      targetOrg,
      sourceDirs,
      manifest,
      dryRun: false,
      testLevel: "NoTestRun"
    });

    const testMode = String(context.inputs.testMode ?? "none");
    let tests: string | undefined;
    if (testMode === "local") {
      await cli.runApexTests({ targetOrg, testLevel: "RunLocalTests" });
      tests = "local";
    } else if (testMode === "specified") {
      const classes = tools.validateApexClasses(context.inputs.apexTestClasses);
      await cli.runApexTests({ targetOrg, testLevel: "RunSpecifiedTests", classes });
      tests = "specified";
    } else if (testMode !== "none") {
      throw new Error("testMode must be none, local or specified.");
    }

    return { deployment: "completed", tests: tests ?? "skipped", output: deployment.stdout.slice(-3000) };
  }
});
