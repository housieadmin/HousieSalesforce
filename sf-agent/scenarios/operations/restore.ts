import { defineScenario } from "@sf-agent/core";
import { deployWithPolicy } from "./deployment.js";

export default defineScenario({
  name: "restore",
  async run(context) {
    const result = await deployWithPolicy(context, "RESTORE");
    return { restore: "completed", tests: result.testMode, output: result.output };
  }
});
