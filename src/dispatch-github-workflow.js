import { execFileSync } from "node:child_process";

export function dispatchGitHubWorkflow({ owner, repository, workflowId, inputs, ref = "main" }) {
  if (!owner || !repository || !workflowId) throw new Error("Repository and workflow are required.");
  execFileSync("gh", ["api", "repos/" + owner + "/" + repository + "/commits/" + encodeURIComponent(ref)], { stdio: "ignore" });
  execFileSync("gh", [
    "api", "-X", "POST",
    "repos/" + owner + "/" + repository + "/actions/workflows/" + workflowId + "/dispatches",
    "--input", "-"
  ], { input: JSON.stringify({ ref, inputs }), stdio: "inherit" });
}
