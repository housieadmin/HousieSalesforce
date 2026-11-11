import { runSalesforceCli } from "./run-salesforce-cli.js";

export function deployMetadata({ paths, manifest, targetOrg, dryRun = false }) {
  if (!targetOrg) throw new Error("targetOrg is required.");
  if ((!Array.isArray(paths) || paths.length === 0) === !manifest) throw new Error("Specify either source paths or one manifest.");
  const args = ["project", "deploy", "start", ...(dryRun ? ["--dry-run"] : [])];
  if (manifest) args.push("--manifest", manifest);
  else for (const item of paths) args.push("--source-dir", item);
  args.push("--target-org", targetOrg, "--test-level", "NoTestRun", "--wait", "60");
  return runSalesforceCli(args);
}
