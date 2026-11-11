import { execFileSync } from "node:child_process";
import { resolveMetadataPaths } from "./resolve-metadata-paths.js";
import { deployMetadata } from "./deploy-metadata.js";
import { runApexTests } from "./run-apex-tests.js";
import { listTrackedFiles } from "./list-tracked-files.js";
import { writeGitHubSummary } from "./write-github-summary.js";

export function restoreFeatureMetadata(env = process.env) {
  let paths = [];
  let status = "failed";
  try {
    if (env.CONFIRM_RESTORE !== "RESTORE") throw new Error("Type RESTORE to authorize recovery deployment.");
    if (!env.RESTORE_REF) throw new Error("A known-good restore ref is required.");
    paths = resolveMetadataPaths(env.SOURCE_PATHS_INPUT, { trackedFiles: listTrackedFiles() });
    const targetOrg = env.SF_TARGET_ORG_ALIAS || "housie-dev";
    deployMetadata({ paths, targetOrg, dryRun: true });
    deployMetadata({ paths, targetOrg });
    if (env.RUN_LOCAL_TESTS === "true") runApexTests({ mode: "local", classes: [] }, targetOrg);
    status = "completed";
  } finally {
    let commit = "unknown";
    try { commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch {}
    writeGitHubSummary([
      "### Salesforce metadata restore",
      "- Result: " + status,
      "- Restore ref: " + (env.RESTORE_REF || "unknown"),
      "- Commit: " + commit,
      "- Selected paths:",
      ...paths.map(item => "- `" + item + "`")
    ]);
  }
}
