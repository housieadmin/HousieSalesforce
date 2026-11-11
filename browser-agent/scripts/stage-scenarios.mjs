import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isInside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative);
};

function validateScenarios(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 10 ||
    new Set(files).size !== files.length ||
    files.some(file => typeof file !== "string" ||
      !/^browser-agent\/scenarios\/[A-Za-z0-9._/-]+\.spec\.ts$/.test(file) ||
      file.includes("..") || file.includes("//"))) {
    throw new Error("Invalid scenario list");
  }
}

function copyRegularFiles(sourceRoot, runtimeRoot, filter) {
  if (!fs.existsSync(sourceRoot)) return;
  const rootStat = fs.lstatSync(sourceRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Staging source root must be a regular directory: " + sourceRoot);
  const realRoot = fs.realpathSync(sourceRoot);
  const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("Symlinks are not allowed in staged browser code: " + full);
    if (entry.isDirectory()) return walk(full);
    if (!entry.isFile()) throw new Error("Only regular files can be staged: " + full);
    return filter(full) ? [full] : [];
  });
  for (const source of walk(sourceRoot)) {
    const real = fs.realpathSync(source);
    if (!isInside(realRoot, real)) throw new Error("Staged file escaped its source directory: " + source);
    const relative = path.relative(realRoot, real);
    const target = path.join(runtimeRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(real, target);
  }
}

export function stageScenarios({ scenarios, sourceCheckout = ".browser-agent-source", runtimeCheckout = ".browser-agent-runtime" }) {
  validateScenarios(scenarios);
  const sourceRoot = path.resolve(sourceCheckout);
  const runtimeRoot = path.resolve(runtimeCheckout);
  const sourceScenarios = path.join(sourceRoot, "browser-agent", "scenarios");
  const scenariosStat = fs.lstatSync(sourceScenarios);
  if (!scenariosStat.isDirectory() || scenariosStat.isSymbolicLink()) throw new Error("Scenario source root must be a regular directory.");
  const realScenariosRoot = fs.realpathSync(sourceScenarios);
  const runtimeScenarios = path.join(runtimeRoot, "browser-agent", "scenarios");
  for (const file of scenarios) {
    const source = path.resolve(sourceRoot, file);
    const stat = fs.lstatSync(source);
    const real = fs.realpathSync(source);
    if (!stat.isFile() || stat.isSymbolicLink() || !isInside(realScenariosRoot, real)) {
      throw new Error("Scenario must be a regular file inside browser-agent/scenarios: " + file);
    }
    const relative = path.relative(realScenariosRoot, real);
    const target = path.join(runtimeScenarios, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(real, target);
  }
  copyRegularFiles(
    path.join(sourceRoot, "browser-agent", "utilities"),
    path.join(runtimeRoot, "browser-agent", "utilities"),
    file => file.endsWith(".ts")
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const scenarios = JSON.parse(process.env.SCENARIOS_JSON || "[]");
  stageScenarios({
    scenarios,
    sourceCheckout: process.env.SOURCE_CHECKOUT || ".browser-agent-source",
    runtimeCheckout: process.env.RUNTIME_CHECKOUT || ".browser-agent-runtime"
  });
}
