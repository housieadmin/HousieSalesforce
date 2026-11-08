import fs from "node:fs";
import path from "node:path";

export interface BrowserAgentConfig {
  baseUrl?: string;
  startUrl?: string;
  headless: boolean;
  slowMo: number;
  navigationTimeoutMs: number;
  actionTimeoutMs: number;
  traceOnFailure: boolean;
  artifactsDir: string;
  viewport: { width: number; height: number };
  project: Record<string, unknown>;
}

function expand(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, name: string) => process.env[name] ?? "");
  }
  if (Array.isArray(value)) return value.map(expand);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, expand(item)]));
  }
  return value;
}

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new Error(name + " must be a non-negative number.");
  return value;
}

/** Load generic runner settings. Secrets belong in the environment, never in the JSON file. */
export function loadConfig(configPath = process.env.BROWSER_AGENT_CONFIG || "browser-agent.config.json"): BrowserAgentConfig {
  let source: Record<string, unknown> = {};
  if (fs.existsSync(configPath)) {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Browser agent config must be a JSON object: " + configPath);
    }
    source = expand(parsed) as Record<string, unknown>;
  }

  const browser = (source.browser && typeof source.browser === "object" ? source.browser : {}) as Record<string, unknown>;
  const viewport = (browser.viewport && typeof browser.viewport === "object" ? browser.viewport : {}) as Record<string, unknown>;
  const baseUrl = process.env.BROWSER_AGENT_BASE_URL || source.baseUrl as string | undefined;
  const startUrl = process.env.BROWSER_AGENT_START_URL || source.startUrl as string | undefined;

  if (baseUrl) {
    const parsed = new URL(baseUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("baseUrl must use HTTP or HTTPS.");
  }
  if (startUrl) {
    const parsed = new URL(startUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("startUrl must use HTTP or HTTPS.");
  }

  return {
    baseUrl,
    startUrl,
    headless: process.env.BROWSER_AGENT_HEADLESS === undefined
      ? browser.headless !== false
      : process.env.BROWSER_AGENT_HEADLESS.toLowerCase() !== "false",
    slowMo: numberFromEnv("BROWSER_AGENT_SLOW_MO", Number(browser.slowMo ?? 0)),
    navigationTimeoutMs: numberFromEnv("BROWSER_AGENT_NAVIGATION_TIMEOUT_MS", Number(browser.navigationTimeoutMs ?? 45000)),
    actionTimeoutMs: numberFromEnv("BROWSER_AGENT_ACTION_TIMEOUT_MS", Number(browser.actionTimeoutMs ?? 20000)),
    traceOnFailure: browser.traceOnFailure === true,
    artifactsDir: path.resolve(process.env.BROWSER_AGENT_ARTIFACT_DIR || String(source.artifactsDir || "artifacts/local-run")),
    viewport: {
      width: Number(viewport.width ?? 1440),
      height: Number(viewport.height ?? 1000)
    },
    project: (source.project && typeof source.project === "object" ? source.project : {}) as Record<string, unknown>
  };
}
