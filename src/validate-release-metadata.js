import { resolveManifestPath } from "./resolve-manifest-path.js";
import { deployMetadata } from "./deploy-metadata.js";
import { runApexTests } from "./run-apex-tests.js";

export function validateReleaseMetadata(env = process.env) {
  if (env.CONFIRM_DEPLOYMENT !== "DEPLOY") throw new Error("Type DEPLOY to authorize release deployment.");
  const manifest = resolveManifestPath(env.DEPLOYMENT_SCOPE);
  const targetOrg = env.SF_TARGET_ORG_ALIAS || "housie-dev";
  deployMetadata({ manifest, targetOrg, dryRun: true });
  runApexTests({ mode: "local", classes: [] }, targetOrg);
  deployMetadata({ manifest, targetOrg });
  runApexTests({ mode: "local", classes: [] }, targetOrg);
}
