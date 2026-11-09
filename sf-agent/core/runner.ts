import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { tsImport } from "tsx/esm/api";
import { loadConfig } from "./config.js";
import type {
  EnginePlugin,
  JsonObject,
  JsonValue,
  Logger,
  ScenarioContext,
  UtilityPlugin
} from "./types.js";

const logger: Logger = {
  debug: (message, data) => console.debug("[debug]", message, data ?? ""),
  info: (message, data) => console.info("[info]", message, data ?? ""),
  warn: (message, data) => console.warn("[warn]", message, data ?? ""),
  error: (message, data) => console.error("[error]", message, data ?? "")
};

function safeName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "evidence";
}

async function loadModule(specifier: string, directory: string): Promise<Record<string, unknown>> {
  const target = specifier.startsWith(".") || specifier.startsWith("/")
    ? pathToFileURL(path.resolve(directory, specifier)).href
    : specifier;
  return await tsImport(target, import.meta.url) as Record<string, unknown>;
}

export async function runOperation(file: string, operationName: string, inputOverrides: JsonObject = {}) {
  const { config, directory } = await loadConfig(file);
  const operation = config.operations[operationName];
  if (!operation) {
    throw new Error(`Unknown operation "${operationName}". Available: ${Object.keys(config.operations).join(", ")}`);
  }

  const evidenceDirectory = path.resolve(directory, config.defaults?.evidenceDirectory ?? ".sf-agent/evidence");
  await fs.mkdir(evidenceDirectory, { recursive: true });
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const evidence = {
    async record(name: string, value: JsonValue): Promise<void> {
      const fileName = `${runId}-${safeName(name)}.json`;
      await fs.writeFile(path.join(evidenceDirectory, fileName), JSON.stringify(value, null, 2));
    },
    async attach(name: string, data: Uint8Array, contentType: string): Promise<string> {
      const extension = contentType === "image/png" ? "png" :
        contentType === "application/pdf" ? "pdf" : "bin";
      const filePath = path.join(evidenceDirectory, `${runId}-${safeName(name)}.${extension}`);
      await fs.writeFile(filePath, data);
      return filePath;
    }
  };

  const abortController = new AbortController();
  const runtime = { configDirectory: directory, signal: abortController.signal, log: logger, evidence };
  const engines = new Map<string, unknown>();
  const utilities = new Map<string, unknown>();
  const closers: Array<() => Promise<void>> = [];
  const startedAt = Date.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const registerCleanup = (instance: unknown) => {
    if (instance && typeof instance === "object" && "close" in instance &&
      typeof (instance as { close?: unknown }).close === "function") {
      closers.push(async () => {
        await (instance as { close(): Promise<void> | void }).close();
      });
    }
  };

  const createPluginInstance = async (id: string, kind: "engine" | "utility") => {
    const definition = config.plugins.find(plugin => plugin.id === id && plugin.kind === kind);
    if (!definition) throw new Error(`No ${kind} plugin registered as "${id}".`);

    const module = await loadModule(definition.module, directory);
    if (typeof module.createPlugin !== "function") {
      throw new Error(`Plugin module "${definition.module}" must export createPlugin(options).`);
    }

    const plugin = await (module.createPlugin as (options: JsonObject) => EnginePlugin | UtilityPlugin)(
      definition.options ?? {}
    );
    if (!plugin || plugin.id !== id || typeof plugin.create !== "function") {
      throw new Error(`Plugin "${id}" returned an invalid ${kind} registration.`);
    }

    const instance = await plugin.create(definition.options ?? {}, runtime);
    registerCleanup(instance);
    return instance;
  };

  try {
    for (const id of operation.engines) engines.set(id, await createPluginInstance(id, "engine"));
    for (const id of operation.utilities ?? []) utilities.set(id, await createPluginInstance(id, "utility"));

    const scenarioModule = await loadModule(operation.scenario, directory);
    const scenario = (scenarioModule.default ?? scenarioModule.scenario) as {
      name?: string;
      run?: (context: ScenarioContext) => Promise<JsonValue | void>;
    };
    if (typeof scenario?.run !== "function") {
      throw new Error("Scenario module must export a default scenario with run(context).");
    }

    const context: ScenarioContext = {
      operation: operationName,
      inputs: { ...(operation.inputs ?? {}), ...inputOverrides },
      config,
      log: logger,
      evidence,
      signal: abortController.signal,
      engine<T>(id: string): T {
        if (!engines.has(id)) throw new Error(`Engine "${id}" is not enabled for operation "${operationName}".`);
        return engines.get(id) as T;
      },
      utility<T>(id: string): T {
        if (!utilities.has(id)) throw new Error(`Utility "${id}" is not enabled for operation "${operationName}".`);
        return utilities.get(id) as T;
      }
    };

    const timeoutMs = operation.timeoutMs ?? config.defaults?.timeoutMs;
    if (timeoutMs) {
      timeout = setTimeout(
        () => abortController.abort(new Error(`Operation timed out after ${timeoutMs}ms.`)),
        timeoutMs
      );
    }

    const scenarioWork = scenario.run(context);
    const result = timeoutMs
      ? await Promise.race([
          scenarioWork,
          new Promise<never>((_resolve, reject) => {
            abortController.signal.addEventListener("abort", () => reject(abortController.signal.reason), { once: true });
          })
        ])
      : await scenarioWork;

    const summary = {
      status: "completed",
      operation: operationName,
      scenario: scenario.name ?? operation.scenario,
      durationMs: Date.now() - startedAt,
      result: result ?? null
    };
    await evidence.record("run-summary", summary);
    return summary;
  } catch (error) {
    await evidence.record("run-summary", {
      status: "failed",
      operation: operationName,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
    for (const close of closers.reverse()) {
      try {
        await close();
      } catch (error) {
        logger.warn("Plugin cleanup failed.", { error: String(error) });
      }
    }
  }
}
