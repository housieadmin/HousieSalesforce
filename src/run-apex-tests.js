import { runSalesforceCli } from "./run-salesforce-cli.js";

export function runApexTests(selection, targetOrg) {
  if (!selection || !["none", "local", "specified"].includes(selection.mode)) throw new Error("A valid Apex test selection is required.");
  if (selection.mode === "none") return;
  const args = ["apex", "run", "test"];
  if (selection.mode === "local") args.push("--test-level", "RunLocalTests");
  else for (const name of selection.classes) args.push("--tests", name);
  args.push("--target-org", targetOrg, "--result-format", "human", "--wait", "60");
  return runSalesforceCli(args);
}
