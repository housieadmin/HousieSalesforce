import { runSalesforceCli } from "./run-salesforce-cli.js";

export function retrieveMetadata(selection, targetOrg) {
  if (!selection || !targetOrg) throw new Error("A retrieve selection and target org are required.");
  const args = ["project", "retrieve", "start"];
  if (selection.mode === "manifest") args.push("--manifest", selection.manifest);
  else if (selection.mode === "source" && Array.isArray(selection.paths) && selection.paths.length) {
    for (const item of selection.paths) args.push("--source-dir", item);
  } else throw new Error("Invalid retrieve selection.");
  args.push("--target-org", targetOrg, "--wait", "60");
  return runSalesforceCli(args);
}
