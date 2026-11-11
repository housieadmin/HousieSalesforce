import { spawnSync } from "node:child_process";

export function runSalesforceCli(args, { command = "sf", cwd = process.cwd(), env = process.env } = {}) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw new Error("Unable to start Salesforce CLI.");
  if (result.status !== 0) throw new Error("Salesforce CLI command failed: " + command + " " + args.slice(0, 3).join(" "));
  return result;
}
