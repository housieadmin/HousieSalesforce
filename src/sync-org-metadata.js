import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { resolveRetrieveSelection } from "./resolve-retrieve-selection.js";
import { retrieveMetadata } from "./retrieve-metadata.js";
import { createRetrievalPullRequest } from "./create-retrieval-pull-request.js";
import { writeGitHubSummary } from "./write-github-summary.js";

export function syncOrgMetadata(env = process.env) {
  if (env.CONFIRM_SYNC !== "SYNC") throw new Error("Type SYNC to authorize retrieval.");
  const selection = resolveRetrieveSelection({
    pathsInput: env.RETRIEVE_PATHS_INPUT,
    manifest: env.RETRIEVE_MANIFEST || "manifest/package-retrieve.xml"
  });
  const targetOrg = env.SF_TARGET_ORG_ALIAS || "housie-dev";
  retrieveMetadata(selection, targetOrg);
  const changed = execFileSync("git", ["status", "--porcelain", "--", "force-app"], { encoding: "utf8" }).trim().length > 0;
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, "changed=" + changed + "\n");
  let branch;
  if (changed && env.CREATE_PR === "true") {
    branch = createRetrievalPullRequest({ selection, description: env.RUN_DESCRIPTION });
  }
  writeGitHubSummary([
    "### Salesforce org metadata retrieve",
    "- Result: completed",
    "- Changes detected: " + changed,
    "- Pull request created: " + Boolean(branch),
    "- Selection: " + (selection.mode === "manifest" ? selection.manifest : selection.paths.join(", ")),
    "- Description: " + (env.RUN_DESCRIPTION || "Not provided")
  ]);
  return { changed, selection, branch };
}

if (process.argv[1]?.endsWith("/sync-org-metadata.js")) syncOrgMetadata();
