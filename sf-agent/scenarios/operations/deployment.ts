import type { ScenarioContext } from "@sf-agent/core";
import type { SfCliEngine } from "@sf-agent/sf-cli";
import type { ProjectTools } from "../../plugins/project-tools.js";

export interface DeploymentOutcome {
  targetOrg: string;
  deploymentMode: "standard" | "fast";
  testMode: "none" | "local" | "specified";
  output: string;
}

export async function deployWithPolicy(
  context: ScenarioContext,
  confirmation: "DEPLOY" | "RESTORE"
): Promise<DeploymentOutcome> {
  const cli = context.engine<SfCliEngine>("sf-cli");
  const tools = context.utility<ProjectTools>("project-tools");
  tools.requireConfirmation(context.inputs.confirmation, confirmation);

  const targetOrg = tools.requireTargetOrg(context.inputs.targetOrg);
  const sourceDirs = context.inputs.sourcePaths
    ? await tools.resolveSourcePaths(context.inputs.sourcePaths)
    : undefined;
  const manifest = context.inputs.manifest
    ? await tools.resolveManifest(context.inputs.manifest)
    : undefined;

  if (!sourceDirs?.length && !manifest) {
    throw new Error("Deployment requires sourcePaths or a manifest.");
  }

  const isRestore = confirmation === "RESTORE";
  const deploymentMode = isRestore ? "standard" : String(context.inputs.deploymentMode ?? "standard");
  const testMode = isRestore
    ? (context.inputs.runLocalTests === true ? "local" : "none")
    : String(context.inputs.testMode ?? "none");

  if (deploymentMode !== "standard" && deploymentMode !== "fast") {
    throw new Error("deploymentMode must be standard or fast.");
  }
  if (testMode !== "none" && testMode !== "local" && testMode !== "specified") {
    throw new Error("testMode must be none, local or specified.");
  }
  if (deploymentMode === "fast" && testMode !== "none") {
    throw new Error("Fast deployment mode requires testMode=none.");
  }

  // Validate test selection before any org mutation.
  const classes = testMode === "specified"
    ? tools.validateApexClasses(context.inputs.apexTestClasses)
    : undefined;

  const deploymentOptions = { targetOrg, sourceDirs, manifest, testLevel: "NoTestRun" as const };
  if (deploymentMode === "standard") {
    await cli.deploy({ ...deploymentOptions, dryRun: true });
  }
  const deployment = await cli.deploy(deploymentOptions);

  if (testMode === "local") {
    await cli.runApexTests({ targetOrg, testLevel: "RunLocalTests" });
  } else if (testMode === "specified") {
    await cli.runApexTests({ targetOrg, testLevel: "RunSpecifiedTests", classes });
  }

  return {
    targetOrg,
    deploymentMode,
    testMode,
    output: deployment.stdout.slice(-3000)
  };
}
