#!/usr/bin/env node
import { runOperation } from "./runner.js";
import type { JsonObject } from "./types.js";

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

const args = process.argv.slice(2);
const command = args.shift();
if (command !== "run") {
  console.error("Usage: sf-agent run --config <file> --operation <name> [--inputs-json <json>]");
  process.exitCode = 2;
} else {
  const operation = option(args, "--operation");
  const config = option(args, "--config") ?? "sf-agent.config.yml";
  const rawInputs = option(args, "--inputs-json");
  if (!operation) {
    console.error("Missing required --operation.");
    process.exitCode = 2;
  } else {
    try {
      const inputs = rawInputs ? JSON.parse(rawInputs) as JsonObject : {};
      if (!inputs || Array.isArray(inputs) || typeof inputs !== "object") {
        throw new Error("--inputs-json must contain a JSON object.");
      }
      const result = await runOperation(config, operation, inputs);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
