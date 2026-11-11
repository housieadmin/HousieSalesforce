import fs from "node:fs";

export function writeGitHubSummary(lines, file = process.env.GITHUB_STEP_SUMMARY) {
  if (!file) return false;
  fs.appendFileSync(file, lines.join("\n") + "\n");
  return true;
}
