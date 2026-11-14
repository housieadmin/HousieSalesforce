import { deployMetadata } from "./deploy-metadata.js";
import { runApexTests } from "./run-apex-tests.js";

export function validatePullRequest(targetOrg = process.env.SF_TARGET_ORG_ALIAS || "housie-dev") {
  deployMetadata({ manifest: "manifest/package.xml", targetOrg, dryRun: true });
  runApexTests({ mode: "local", classes: [] }, targetOrg);
}

if (process.argv[1]?.endsWith("/validate-pull-request.js")) validatePullRequest();
