import { execFileSync } from "node:child_process";

export function listTrackedFiles(root = process.cwd()) {
  return execFileSync("git", ["-C", root, "ls-files"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
}
