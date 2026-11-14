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
  const sourceTests = path.join(sourceRoot, "tests", "browser");
  const runtimeTests = path.join(runtimeRoot, "tests", "browser");
  const sourceReal = fs.realpathSync(sourceTests);
  for (const file of scenarios) {
    const relative = path.relative("tests/browser", file);
    const source = path.resolve(sourceRoot, file);
    const stat = fs.lstatSync(source);
    const real = fs.realpathSync(source);
    if (!stat.isFile() || stat.isSymbolicLink() || !inside(sourceReal, real)) {
      throw new Error("Browser test must be a regular file under tests/browser/: " + file);
    }
    const destination = path.join(runtimeTests, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(real, destination);
  }
}

if (process.argv[1]?.endsWith("/stage-browser-tests.js")) {
  stageBrowserTests({
    scenarios: JSON.parse(process.env.SCENARIOS_JSON || "[]"),
    sourceCheckout: process.env.SOURCE_CHECKOUT || ".automation-source",
    runtimeCheckout: process.env.RUNTIME_CHECKOUT || ".automation-runtime"
  });
}
