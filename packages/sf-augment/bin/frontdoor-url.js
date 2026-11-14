#!/usr/bin/env node
import { getFrontdoorUrl } from "../src/get-frontdoor-url.js";

const targetOrg = process.argv[2] || process.env.SF_TARGET_ORG_ALIAS;
const lightningPath = process.argv[3];
const url = getFrontdoorUrl({
  targetOrg,
  projectRoot: process.cwd(),
  ...(lightningPath ? { lightningPath } : {})
});
process.stdout.write(url);
