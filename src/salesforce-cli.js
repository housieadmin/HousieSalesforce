import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const required = (value, name) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
};

export function buildJwtLoginArgs({ clientId, username, instanceUrl, jwtKeyFile, alias, setDefault = false }) {
  return [
    "org", "login", "jwt",
    "--client-id", required(clientId, "clientId"),
    "--jwt-key-file", required(jwtKeyFile, "jwtKeyFile"),
    "--username", required(username, "username"),
    "--instance-url", required(instanceUrl, "instanceUrl"),
    "--alias", required(alias, "alias"),
    "--json",
    ...(setDefault ? ["--set-default"] : [])
  ];
}

export function loginWithJwt({
  clientId,
  username,
  instanceUrl,
  jwtKey,
  alias,
  setDefault = false,
  env = process.env,
  command = "sf"
}) {
  required(jwtKey, "jwtKey");
  const directory = mkdtempSync(join(tmpdir(), "sf-augment-jwt-"));
  const keyFile = join(directory, "server.key");
  try {
    writeFileSync(keyFile, jwtKey, { mode: 0o600, flag: "wx" });
    const childEnv = { ...env };
    delete childEnv.SF_JWT_KEY;
    const result = spawnSync(command, buildJwtLoginArgs({
      clientId, username, instanceUrl, jwtKeyFile: keyFile, alias, setDefault
    }), { env: childEnv, encoding: "utf8", stdio: "ignore" });
    if (result.error) throw new Error("Unable to start Salesforce CLI.");
    if (result.status !== 0) {
      throw new Error(`Salesforce JWT authentication failed (exit code ${result.status ?? "unknown"}).`);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
