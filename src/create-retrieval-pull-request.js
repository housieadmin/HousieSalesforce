import { execFileSync } from "node:child_process";

const run = args => execFileSync(args[0], args.slice(1), { stdio: "inherit", env: process.env });

export function createRetrievalPullRequest({ selection, description = "", runId = process.env.GITHUB_RUN_ID }) {
  const branch = "automation/org-retrieve-" + String(runId || Date.now()).replace(/[^0-9]/g, "");
  run(["git", "config", "user.name", "github-actions[bot]"]);
  run(["git", "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
  run(["git", "switch", "-c", branch]);
  run(["git", "add", "force-app/"]);
  run(["git", "commit", "-m", "chore: retrieve metadata from Salesforce org"]);
  run(["git", "push", "origin", branch]);
  const chosen = selection.mode === "manifest" ? selection.manifest : selection.paths.join(", ");
  const body = [
    "Automated Salesforce metadata retrieval.", "",
    "Selection: " + chosen,
    "Description: " + (description || "Not provided"), "",
    "Review the full diff carefully. Retrieved metadata is proposed through this PR and is never written directly to main."
  ].join("\n");
  run(["gh", "pr", "create", "--base", "main", "--head", branch, "--title", "Retrieve Salesforce metadata from org", "--body", body]);
  return branch;
}
