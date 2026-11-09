import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { EnginePlugin, EngineRuntime, JsonObject } from "@sf-agent/core";

export interface SfCliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SfCliOptions {
  binary?: string;
  cwd?: string;
}

export interface JwtCredentials {
  clientId: string;
  privateKey: string;
  username: string;
  instanceUrl: string;
  alias: string;
  setDefault?: boolean;
}

export interface DeployOptions {
  targetOrg: string;
  sourceDirs?: string[];
  manifest?: string;
  dryRun?: boolean;
  testLevel?: "NoTestRun" | "RunSpecifiedTests" | "RunLocalTests" | "RunAllTestsInOrg";
  waitMinutes?: number;
}

export interface RetrieveOptions {
  targetOrg: string;
  manifest?: string;
  metadata?: string[];
  outputDir?: string;
  waitMinutes?: number;
}

export interface ApexTestOptions {
  targetOrg: string;
  testLevel?: "RunLocalTests" | "RunSpecifiedTests" | "RunAllTestsInOrg";
  classes?: string[];
  waitMinutes?: number;
}

export interface OpenOrgUrlOptions {
  targetOrg: string;
  path?: string;
}

export class SfCliEngine {
  constructor(
    private readonly options: SfCliOptions = {},
    private readonly runtime?: EngineRuntime
  ) {}

  run(
    args: string[],
    options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}
  ): Promise<SfCliResult> {
    if (!args.length || args.some(argument => typeof argument !== "string" || argument.includes("\0"))) {
      throw new Error("sf arguments must be a non-empty array of strings.");
    }

    return new Promise((resolve, reject) => {
      const child = spawn(this.options.binary ?? "sf", args, {
        cwd: options.cwd ?? this.options.cwd,
        env: { ...process.env, ...options.env },
        shell: false,
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8").on("data", chunk => { stdout += chunk; });
      child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });

      const stop = () => { child.kill("SIGTERM"); };
      const signal = this.runtime?.signal;
      if (signal?.aborted) stop();
      else signal?.addEventListener("abort", stop, { once: true });
      const timer = options.timeoutMs ? setTimeout(stop, options.timeoutMs) : undefined;

      child.on("error", error => {
        if (timer) clearTimeout(timer);
        signal?.removeEventListener("abort", stop);
        reject(error);
      });
      child.on("close", code => {
        if (timer) clearTimeout(timer);
        signal?.removeEventListener("abort", stop);
        const result = { stdout, stderr, exitCode: code ?? 1 };
        if (result.exitCode !== 0) {
          reject(Object.assign(
            new Error(`sf ${args[0]} failed (exit ${result.exitCode}): ${stderr.slice(0, 2000)}`),
            { result }
          ));
        } else {
          resolve(result);
        }
      });
    });
  }

  async loginJwt(credentials: JwtCredentials): Promise<void> {
    const { clientId, privateKey, username, instanceUrl, alias, setDefault } = credentials;
    if (!clientId || !privateKey || !username || !instanceUrl || !alias) {
      throw new Error("JWT login requires clientId, privateKey, username, instanceUrl and alias.");
    }
    if (!/^https:\/\//i.test(instanceUrl)) throw new Error("JWT instanceUrl must use HTTPS.");
    if (!/^[A-Za-z0-9_-]+$/.test(alias)) throw new Error("Invalid sf org alias.");

    const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sf-agent-jwt-"));
    const keyFile = path.join(directory, "server.key");
    try {
      await fs.writeFile(keyFile, privateKey, { mode: 0o600 });
      await fs.chmod(keyFile, 0o600);
      const args = [
        "org", "login", "jwt",
        "--client-id", clientId,
        "--jwt-key-file", keyFile,
        "--username", username,
        "--instance-url", instanceUrl,
        "--alias", alias
      ];
      if (setDefault) args.push("--set-default");
      await this.run(args);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
  }

  async deploy(options: DeployOptions): Promise<SfCliResult> {
    if (!options.targetOrg) throw new Error("deploy requires targetOrg.");
    if (!options.manifest && !options.sourceDirs?.length) {
      throw new Error("deploy requires a manifest or sourceDirs.");
    }

    const args = ["project", "deploy", "start"];
    if (options.dryRun) args.push("--dry-run");
    if (options.manifest) args.push("--manifest", options.manifest);
    for (const directory of options.sourceDirs ?? []) args.push("--source-dir", directory);
    args.push(
      "--target-org", options.targetOrg,
      "--test-level", options.testLevel ?? "NoTestRun",
      "--wait", String(options.waitMinutes ?? 60)
    );
    return this.run(args);
  }

  async retrieve(options: RetrieveOptions): Promise<SfCliResult> {
    if (!options.targetOrg) throw new Error("retrieve requires targetOrg.");
    if (!options.manifest && !options.metadata?.length) {
      throw new Error("retrieve requires a manifest or metadata selection.");
    }

    const args = ["project", "retrieve", "start"];
    if (options.manifest) args.push("--manifest", options.manifest);
    for (const item of options.metadata ?? []) args.push("--metadata", item);
    if (options.outputDir) args.push("--output-dir", options.outputDir);
    args.push("--target-org", options.targetOrg, "--wait", String(options.waitMinutes ?? 60));
    return this.run(args);
  }

  async runApexTests(options: ApexTestOptions): Promise<SfCliResult> {
    if (!options.targetOrg) throw new Error("Apex tests require targetOrg.");
    const level = options.testLevel ?? (options.classes?.length ? "RunSpecifiedTests" : "RunLocalTests");
    if (level === "RunSpecifiedTests" &&
      (!options.classes?.length || options.classes.some(name => !/^[A-Za-z][A-Za-z0-9_]*$/.test(name)))) {
      throw new Error("RunSpecifiedTests requires valid Apex class names.");
    }
    if (level !== "RunSpecifiedTests" && options.classes?.length) {
      throw new Error("Apex class names are valid only with RunSpecifiedTests.");
    }

    const args = [
      "apex", "run", "test",
      "--target-org", options.targetOrg,
      "--test-level", level,
      "--result-format", "human",
      "--wait", String(options.waitMinutes ?? 60)
    ];
    for (const name of options.classes ?? []) args.push("--tests", name);
    return this.run(args);
  }

  async openOrgUrl(options: OpenOrgUrlOptions): Promise<string> {
    if (!options.targetOrg) throw new Error("openOrgUrl requires targetOrg.");
    const args = ["org", "open", "--url-only", "--target-org", options.targetOrg, "--json"];
    if (options.path) args.push("--path", options.path);

    const { stdout } = await this.run(args);
    const jsonStart = stdout.indexOf("{");
    if (jsonStart < 0) throw new Error("sf org open did not return JSON.");
    const response = JSON.parse(stdout.slice(jsonStart));
    const url = response?.result?.url;
    if (typeof url !== "string" || !/^https:\/\//i.test(url)) {
      throw new Error("sf org open did not return a valid HTTPS URL.");
    }
    return url;
  }
}

export function createPlugin(options: JsonObject = {}): EnginePlugin<SfCliOptions, SfCliEngine> {
  return {
    id: "sf-cli",
    create(_pluginOptions, runtime) {
      const configured = options as SfCliOptions;
      const cwd = configured.cwd
        ? path.resolve(runtime.configDirectory, configured.cwd)
        : runtime.configDirectory;
      return new SfCliEngine({ ...configured, cwd }, runtime);
    }
  };
}
