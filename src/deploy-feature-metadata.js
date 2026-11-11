import { execFileSync } from "node:child_process";
import { resolveMetadataPaths } from "./resolve-metadata-paths.js";
import { resolveApexTestSelection } from "./resolve-apex-test-selection.js";
import { deployMetadata } from "./deploy-metadata.js";
import { runApexTests } from "./run-apex-tests.js";
import { listTrackedFiles } from "./list-tracked-files.js";
import { writeGitHubSummary } from "./write-github-summary.js";

export function deployFeatureMetadata(env = process.env) {
  const mode = env.DEPLOYMENT_MODE || "standard";
  const testMode = env.TEST_MODE || "none";
  let paths = [];
  let status = "failed";
  try {
    if (env.CONFIRM_DEPLOYMENT !== "DEPLOY") throw new Error("Type DEPLOY to authorize this deployment.");
    if (!env.SOURCE_REF) throw new Error("Source ref is required.");
    if (!["standard", "fast"].includes(mode)) throw new Error("Unsupported deployment mode.");
    const tests = resolveApexTestSelection(testMode, env.APEX_TEST_CLASSES_INPUT);
    if (mode === "fast" && tests.mode !== "none") throw new Error("Fast mode requires tests=none.");
    paths = resolveMetadataPaths(env.SOURCE_PATHS_INPUT, { trackedFiles: listTrackedFiles() });
    const targetOrg = env.SF_TARGET_ORG_ALIAS || "housie-dev";
    if (mode === "standard") deployMetadata({ paths, targetOrg, dryRun: true });
    deployMetadata({ paths, targetOrg });
    if (mode === "standard") runApexTests(tests, targetOrg);
    status = "completed";
  } finally {
    let commit = "unknown";
    try { commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch {}
    writeGitHubSummary([
      "### Salesforce feature deployment",
      "- Result: " + status,
      "- Source ref: " + (env.SOURCE_REF || "unknown"),
      "- Commit: " + commit,
      "- Deployment mode: " + mode,
      "- Test mode: " + testMode,
      "- Selected paths:",
      ...paths.map(item => "- `" + item + "`")
    ]);
  }
}

if (process.argv[1]?.endsWith("/deploy-feature-metadata.js")) deployFeatureMetadata();
