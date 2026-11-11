import { resolveManifestPath } from "./resolve-manifest-path.js";
import { deployMetadata } from "./deploy-metadata.js";
import { runApexTests } from "./run-apex-tests.js";

export function validateManualMetadata(env = process.env) {
  const manifest = resolveManifestPath(env.MANIFEST_SCOPE, env.CUSTOM_MANIFEST);
  const targetOrg = env.SF_TARGET_ORG_ALIAS || "housie-dev";
  deployMetadata({ manifest, targetOrg, dryRun: true });
  if (env.RUN_APEX_TESTS === "true") runApexTests({ mode: "local", classes: [] }, targetOrg);
}
