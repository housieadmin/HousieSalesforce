#!/usr/bin/env node
import { loginWithJwt } from "../src/salesforce-cli.js";

const env = process.env;
loginWithJwt({
  clientId: env.SF_CLIENT_ID,
  username: env.SF_USERNAME,
  instanceUrl: env.SF_INSTANCE_URL,
  jwtKey: env.SF_JWT_KEY,
  alias: process.argv[2] || env.SF_TARGET_ORG_ALIAS,
  setDefault: process.argv.includes("--set-default")
});
