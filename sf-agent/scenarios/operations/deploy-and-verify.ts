import { defineScenario } from "@sf-agent/core";
import type { SfCliEngine } from "@sf-agent/sf-cli";
import type { SfBrowserEngine } from "@sf-agent/sf-browser";
import { deployWithPolicy } from "./deployment.js";

export default defineScenario({
  name: "deploy-and-verify",
  async run(context) {
    const cli = context.engine<SfCliEngine>("sf-cli");
    const browser = context.engine<SfBrowserEngine>("sf-browser");
    const deployment = await deployWithPolicy(context, "DEPLOY");

    const frontdoorUrl = await cli.openOrgUrl({
      targetOrg: deployment.targetOrg,
      path: String(context.inputs.browserPath ?? "/lightning/page/home")
    });
    await browser.goto(frontdoorUrl);
    const pageTitle = await browser.getPage().title();
    await browser.screenshot("post-deployment-verification");

    return {
      deployment: "completed",
      mode: deployment.deploymentMode,
      tests: deployment.testMode,
      browser: "completed",
      pageTitle,
      deploymentOutput: deployment.output.slice(-2000)
    };
  }
});
