import fs from "node:fs";
import path from "node:path";
import { validateScenarios } from "./parse-browser-request.js";

const inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
};

export function stageBrowserTests({ scenarios, sourceCheckout = ".automation-source", runtimeCheckout = ".automation-runtime" }) {
  validateScenarios(scenarios);
  const sourceRoot = path.resolve(sourceCheckout);
  const runtimeRoot = path.resolve(runtimeCheckout);
  const sourceTests = path.join(sourceRoot, "tests", "e2e");
  const runtimeTests = path.join(runtimeRoot, "tests", "e2e");
  const sourceReal = fs.realpathSync(sourceTests);
  for (const file of scenarios) {
    const relative = path.relative("tests/e2e", file);
    const source = path.resolve(sourceRoot, file);
    const stat = fs.lstatSync(source);
    const real = fs.realpathSync(source);
    if (!stat.isFile() || stat.isSymbolicLink() || !inside(sourceReal, real)) {
      throw new Error("E2E test must be a regular file under tests/e2e/: " + file);
    }
    const destination = path.join(runtimeTests, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(real, destination);
  }
}
