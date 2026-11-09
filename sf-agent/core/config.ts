import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "yaml";
import type { AgentConfig, JsonObject, JsonValue, PluginConfig } from "./types.js";

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

function expandEnvironment(value: unknown, location: string): unknown {
  if (typeof value === "string") {
    return value.replace(
      /\$\{ENV:([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g,
      (_match, name: string, fallback: string | undefined) => {
        const resolved = process.env[name];
        if (resolved !== undefined) return resolved;
        if (fallback !== undefined) return fallback;
        throw new Error(`Missing environment variable ${name} referenced at ${location}.`);
      }
    );
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => expandEnvironment(item, `${location}[${index}]`));
  }
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, expandEnvironment(item, `${location}.${key}`)])
    );
  }
  return value;
}

const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isObject(value) && Object.values(value).every(isJsonValue);
};

const isJsonObject = (value: unknown): value is JsonObject =>
  isObject(value) && Object.values(value).every(isJsonValue);

function validatePlugin(value: unknown, index: number): PluginConfig {
  if (
    !isObject(value) ||
    typeof value.id !== "string" ||
    !/^[a-z][a-z0-9-]*$/.test(value.id) ||
    typeof value.module !== "string" ||
    !value.module.trim()
  ) {
    throw new Error(`plugins[${index}] requires a valid id and module.`);
  }

  const kind = value.kind ?? "engine";
  if (kind !== "engine" && kind !== "utility") {
    throw new Error(`plugins[${index}].kind must be engine or utility.`);
  }
  if (value.options !== undefined && !isJsonObject(value.options)) {
    throw new Error(`plugins[${index}].options must be a JSON object.`);
  }

  return {
    id: value.id,
    module: value.module,
    kind,
    ...(value.options ? { options: value.options } : {})
  };
}

export function validateConfig(value: unknown): AgentConfig {
  if (!isObject(value) || value.version !== 1) {
    throw new Error("Configuration version must be 1.");
  }
  if (!Array.isArray(value.plugins) || !isObject(value.operations) || Object.keys(value.operations).length === 0) {
    throw new Error("plugins and non-empty operations are required.");
  }

  const plugins = value.plugins.map(validatePlugin);
  const pluginKinds = new Map<string, PluginConfig["kind"]>();
  for (const plugin of plugins) {
    if (pluginKinds.has(plugin.id)) throw new Error(`Duplicate plugin id: ${plugin.id}`);
    pluginKinds.set(plugin.id, plugin.kind);
  }

  const operations: AgentConfig["operations"] = {};
  for (const [name, raw] of Object.entries(value.operations)) {
    if (!/^[a-z][a-z0-9-]*$/.test(name) || !isObject(raw) || typeof raw.scenario !== "string") {
      throw new Error(`Invalid operation definition: ${name}`);
    }

    const engines = raw.engines ?? [];
    const utilities = raw.utilities ?? [];
    if (!Array.isArray(engines) || engines.some(id => typeof id !== "string" || pluginKinds.get(id) !== "engine")) {
      throw new Error(`operations.${name}.engines must reference registered engine plugins.`);
    }
    if (!Array.isArray(utilities) || utilities.some(id => typeof id !== "string" || pluginKinds.get(id) !== "utility")) {
      throw new Error(`operations.${name}.utilities must reference registered utility plugins.`);
    }
    if (raw.inputs !== undefined && !isJsonObject(raw.inputs)) {
      throw new Error(`operations.${name}.inputs must be a JSON object.`);
    }
    if (raw.timeoutMs !== undefined && (!Number.isInteger(raw.timeoutMs) || (raw.timeoutMs as number) <= 0)) {
      throw new Error(`operations.${name}.timeoutMs must be a positive integer.`);
    }

    operations[name] = {
      scenario: raw.scenario,
      engines: [...new Set(engines as string[])],
      ...(utilities.length ? { utilities: [...new Set(utilities as string[])] } : {}),
      ...(raw.inputs ? { inputs: raw.inputs } : {}),
      ...(raw.timeoutMs ? { timeoutMs: raw.timeoutMs as number } : {})
    };
  }

  let defaults: AgentConfig["defaults"];
  if (value.defaults !== undefined) {
    if (
      !isObject(value.defaults) ||
      (value.defaults.timeoutMs !== undefined &&
        (!Number.isInteger(value.defaults.timeoutMs) || (value.defaults.timeoutMs as number) <= 0)) ||
      (value.defaults.evidenceDirectory !== undefined && typeof value.defaults.evidenceDirectory !== "string")
    ) {
      throw new Error("Invalid defaults.");
    }
    defaults = {
      ...(value.defaults.timeoutMs ? { timeoutMs: value.defaults.timeoutMs as number } : {}),
      ...(value.defaults.evidenceDirectory ? { evidenceDirectory: value.defaults.evidenceDirectory as string } : {})
    };
  }

  return { version: 1, plugins, operations, ...(defaults ? { defaults } : {}) };
}

export async function loadConfig(file: string) {
  const absolute = path.resolve(file);
  const parsed = parse(await fs.readFile(absolute, "utf8")) as unknown;
  return {
    config: validateConfig(expandEnvironment(parsed, absolute)),
    directory: path.dirname(absolute)
  };
}
