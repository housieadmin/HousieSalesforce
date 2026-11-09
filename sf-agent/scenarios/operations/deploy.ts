import { defineScenario } from "@sf-agent/core";
import { deployWithPolicy } from "./deployment.js";

export default defineScenario({
  name: "deploy",
  async run(context) {
    const result = await deployWithPolicy(context, "DEPLOY");
    return {
      deployment: "completed",
      mode: result.deploymentMode,
      tests: result.testMode,
      output: result.output
    };
  }
});
