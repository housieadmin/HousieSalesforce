import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import type { EngineRuntime, JsonObject, UtilityPlugin } from "@sf-agent/core";

export interface ProjectTools {
  requireConfirmation(value: unknown, expected: string): void;
  requireTargetOrg(value: unknown): string;
  resolveSourcePaths(values: unknown): Promise<string[]>;
  resolveManifest(value: unknown): Promise<string>;
  resolveOutputDirectory(value: unknown): Promise<string | undefined>;
  validateApexClasses(values: unknown): string[];
}

export function createPlugin(options: JsonObject = {}): UtilityPlugin<JsonObject, ProjectTools> {
  return {
    id: "project-tools",
    create(_pluginOptions, runtime: EngineRuntime) {
      const configuredRoot = typeof options.projectDirectory === "string" ? options.projectDirectory : "..";
      const projectRoot = path.resolve(runtime.configDirectory, configuredRoot);
      const forceRoot = path.join(projectRoot, "force-app");
      const manifestRoot = path.join(projectRoot, "manifest");

      async function resolveInside(root: string, relativePath: string, label: string): Promise<string> {
        const absolute = path.resolve(projectRoot, relativePath);
        if (!absolute.startsWith(root + path.sep)) throw new Error(`${label} escapes its allowed directory.`);
        const real = await fs.realpath(absolute);
        if (!real.startsWith(root + path.sep)) throw new Error(`${label} resolves outside its allowed directory.`);
        return real;
      }

      return {
        requireConfirmation(value, expected) {
          if (value !== expected) throw new Error(`This operation requires the exact confirmation: ${expected}.`);
        },

        requireTargetOrg(value) {
          if (typeof value !== "string" || !value.trim() || value.startsWith("-") || /[\r\n]/.test(value)) {
            throw new Error("targetOrg must be a valid non-empty org alias or username.");
          }
          return value.trim();
        },

        async resolveSourcePaths(values) {
          if (!Array.isArray(values) || values.length < 1 || values.length > 25) {
            throw new Error("Provide between 1 and 25 source paths.");
          }
          const resolved: string[] = [];
          for (const value of values) {
            if (typeof value !== "string" ||
              !/^force-app\/[A-Za-z0-9._/-]+$/.test(value) ||
              value.includes("..") || value.includes("//") || value.endsWith("/")) {
              throw new Error(`Invalid source path: ${String(value)}`);
            }
            const absolute = await resolveInside(forceRoot, value, "Source path");
            const stat = await fs.stat(absolute);
            if (!stat.isFile() && !stat.isDirectory()) throw new Error(`Source path is not a file or directory: ${value}`);
            const tracked = execFileSync("git", ["ls-files", "--error-unmatch", value], {
              cwd: projectRoot,
              encoding: "utf8",
              stdio: ["ignore", "pipe", "ignore"]
            }).trim();
            if (!tracked) throw new Error(`Source path is not tracked in the selected ref: ${value}`);
            resolved.push(value);

            if (stat.isFile() && (value.endsWith(".cls") || value.endsWith(".trigger"))) {
              const companion = `${value}-meta.xml`;
              try {
                const companionPath = await resolveInside(forceRoot, companion, "Metadata companion");
                if ((await fs.stat(companionPath)).isFile()) resolved.push(companion);
              } catch {
                // Some metadata formats do not have a companion file.
              }
            }
          }
          return [...new Set(resolved)];
        },

        async resolveManifest(value) {
          if (typeof value !== "string" ||
            !/^manifest\/[A-Za-z0-9._/-]+\.xml$/.test(value) ||
            value.includes("..") || value.includes("//")) {
            throw new Error("Manifest must be an XML file under manifest/.");
          }
          const absolute = await resolveInside(manifestRoot, value, "Manifest");
          if (!(await fs.stat(absolute)).isFile()) throw new Error("Manifest must be a file.");
          return value;
        },

        async resolveOutputDirectory(value) {
          if (value === undefined || value === null || value === "") return undefined;
          if (typeof value !== "string" || path.isAbsolute(value) || value.includes("..")) {
            throw new Error("outputDirectory must be a relative path inside the project.");
          }
          const projectRealPath = await fs.realpath(projectRoot);
          const absolute = path.resolve(projectRealPath, value);
          if (!absolute.startsWith(projectRealPath + path.sep)) throw new Error("outputDirectory escapes the project.");

          let current = projectRealPath;
          for (const segment of path.relative(projectRealPath, absolute).split(path.sep)) {
            current = path.join(current, segment);
            try {
              const real = await fs.realpath(current);
              if (!real.startsWith(projectRealPath + path.sep)) {
                throw new Error("outputDirectory resolves through a symlink outside the project.");
              }
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
              break;
            }
          }

          await fs.mkdir(absolute, { recursive: true });
          const resolved = await fs.realpath(absolute);
          if (!resolved.startsWith(projectRealPath + path.sep)) {
            throw new Error("outputDirectory resolves outside the project.");
          }
          return resolved;
        },

        validateApexClasses(values) {
          if (!Array.isArray(values) || values.length < 1 || values.length > 30 ||
            values.some(value => typeof value !== "string" || !/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) ||
            new Set(values).size !== values.length) {
            throw new Error("Provide 1–30 unique Apex test class names.");
          }
          return values as string[];
        }
      };
    }
  };
}
