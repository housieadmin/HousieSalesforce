import { defineScenario } from "@sf-agent/core";
import type { SfCliEngine } from "@sf-agent/sf-cli";
import type { SfBrowserEngine } from "@sf-agent/sf-browser";
import type { ProjectTools } from "../../plugins/project-tools.js";

export default defineScenario({
  name: "deploy-and-verify",
  async run(context) {
    const cli = context.engine<SfCliEngine>("sf-cli");
    const browser = context.engine<SfBrowserEngine>("sf-browser");
    const tools = context.utility<ProjectTools>("project-tools");
    tools.requireConfirmation(context.inputs.confirmation, "DEPLOY");

    const targetOrg = tools.requireTargetOrg(context.inputs.targetOrg);
    const sourceDirs = await tools.resolveSourcePaths(context.inputs.sourcePaths);
    const deployment = await cli.deploy({ targetOrg, sourceDirs, testLevel: "NoTestRun" });

    const frontdoorUrl = await cli.openOrgUrl({
      targetOrg,
      path: String(context.inputs.browserPath ?? "/lightning/page/home")
    });
    await browser.goto(frontdoorUrl);
    const pageTitle = await browser.getPage().title();
    await browser.screenshot("post-deployment-verification");

    return {
      deployment: "completed",
      browser: "completed",
      pageTitle,
      deploymentOutput: deployment.stdout.slice(-2000)
    };
  }
});
