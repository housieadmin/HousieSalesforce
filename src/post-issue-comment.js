import { execFileSync } from "node:child_process";

export function postIssueComment({ owner, repository, issueNumber, body }) {
  if (!owner || !repository || !Number.isInteger(Number(issueNumber)) || Number(issueNumber) < 1) {
    throw new Error("A valid GitHub issue is required.");
  }
  execFileSync("gh", [
    "api", "-X", "POST",
    "repos/" + owner + "/" + repository + "/issues/" + issueNumber + "/comments",
    "--input", "-"
  ], { input: JSON.stringify({ body: String(body) }), stdio: "inherit" });
}
