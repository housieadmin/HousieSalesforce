import { execFileSync } from "node:child_process";
import { extractFrontdoorUrl } from "./extract-frontdoor-url.js";

export function getFrontdoorUrl({ targetOrg, projectRoot, lightningPath, timeout = 60000 } = {}) {
  if (typeof targetOrg !== "string" || !targetOrg.trim()) throw new Error("targetOrg is required.");
  if (typeof projectRoot !== "string" || !projectRoot.trim()) throw new Error("projectRoot is required.");
  const args = ["org", "open", "--url-only"];
  if (lightningPath !== undefined) {
    if (typeof lightningPath !== "string" || !lightningPath.startsWith("/lightning/")) {
      throw new Error("Expected a Lightning route beginning with /lightning/.");
    }
    args.push("--path", lightningPath);
  }
  args.push("--target-org", targetOrg.trim(), "--json");
  const output = execFileSync("sf", args, { cwd: projectRoot, encoding: "utf8", timeout });
  return extractFrontdoorUrl(output);
}
