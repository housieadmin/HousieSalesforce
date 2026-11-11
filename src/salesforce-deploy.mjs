import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
};

export function splitSelections(value) {
  return String(value || "").split(/[\r\n,]+/).map(item => item.trim()).filter(Boolean);
}

export function resolveMetadataPaths(input, { root = process.cwd(), trackedFiles = [] } = {}) {
  const selected = splitSelections(input);
  if (!selected.length) throw new Error("At least one metadata path is required.");
  const workspace = fs.realpathSync(root);
  const forceRoot = fs.realpathSync(path.join(workspace, "force-app"));
  const tracked = new Set(trackedFiles);
  const result = [];
  const seen = new Set();
  for (const item of selected) {
    if (!/^force-app\/[A-Za-z0-9._/-]+$/.test(item) || item.includes("..") || item.includes("//") || item.endsWith("/")) {
      throw new Error("Rejected path (must be a literal path under force-app/): " + item);
    }
    const absolute = path.resolve(workspace, item);
    const stat = fs.lstatSync(absolute);
    const real = fs.realpathSync(absolute);
    if (stat.isSymbolicLink() || !inside(forceRoot, real)) throw new Error("Path escapes force-app/: " + item);
    if (stat.isFile()) {
      if (!tracked.has(item)) throw new Error("Path is not tracked in the selected ref: " + item);
      if ((item.endsWith(".cls") || item.endsWith(".trigger")) && tracked.has(item + "-meta.xml")) {
        if (!seen.has(item + "-meta.xml")) { seen.add(item + "-meta.xml"); result.push(item + "-meta.xml"); }
      }
    } else if (stat.isDirectory()) {
      if (![...tracked].some(file => file.startsWith(item + "/"))) throw new Error("Directory has no tracked source files: " + item);
    } else {
      throw new Error("Metadata path must be a regular file or directory: " + item);
    }
    if (!seen.has(item)) { seen.add(item); result.push(item); }
  }
  return result;
}

export function resolveManifestPath(scope, customManifest, { root = process.cwd() } = {}) {
  const standard = {
    application: "manifest/package.xml",
    "org-setup": "manifest/package-org-setup.xml",
    experience: "manifest/package-experience.xml"
  };
  const selected = scope === "custom" ? String(customManifest || "") : standard[scope];
  if (!selected || !/^manifest\/[A-Za-z0-9._/-]+\.xml$/.test(selected) || selected.includes("..") || selected.includes("//")) {
    throw new Error("Manifest must be a safe XML path under manifest/.");
  }
  const manifestRoot = fs.realpathSync(path.join(root, "manifest"));
  const absolute = path.resolve(root, selected);
  const stat = fs.lstatSync(absolute);
  const real = fs.realpathSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || !inside(manifestRoot, real)) {
    throw new Error("Manifest not found or outside manifest/: " + selected);
  }
  return selected;
}

export function resolveTestSelection(mode, input = "") {
  if (!["none", "local", "specified"].includes(mode)) throw new Error("Unsupported test mode: " + mode);
  if (mode !== "specified") return { mode, classes: [] };
  const classes = String(input || "").split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  if (!classes.length || classes.some(name => !/^[A-Za-z][A-Za-z0-9_]*$/.test(name))) {
    throw new Error("specified test mode requires valid Apex test class names.");
  }
  return { mode, classes: [...new Set(classes)] };
}

function runSf(args) {
  const result = spawnSync("sf", args, { stdio: "inherit", env: process.env });
  if (result.error) throw new Error("Unable to start Salesforce CLI.");
  if (result.status !== 0) throw new Error("Salesforce CLI command failed: sf " + args.slice(0, 3).join(" "));
}

function deployPaths(paths, targetOrg, dryRun) {
  const args = ["project", "deploy", "start", ...(dryRun ? ["--dry-run"] : [])];
  for (const item of paths) args.push("--source-dir", item);
  runSf([...args, "--target-org", targetOrg, "--test-level", "NoTestRun", "--wait", "60"]);
}

function deployManifest(manifest, targetOrg, dryRun) {
  runSf(["project", "deploy", "start", ...(dryRun ? ["--dry-run"] : []), "--manifest", manifest, "--target-org", targetOrg, "--test-level", "NoTestRun", "--wait", "60"]);
}

function runApexTests(selection, targetOrg) {
  if (selection.mode === "none") return;
  const args = ["apex", "run", "test"];
  if (selection.mode === "local") args.push("--test-level", "RunLocalTests");
  else for (const name of selection.classes) args.push("--tests", name);
  runSf([...args, "--target-org", targetOrg, "--result-format", "human", "--wait", "60"]);
}

function appendSummary(lines) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

function trackedFiles(root) {
  return execFileSync("git", ["-C", root, "ls-files"], { encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
}

function targetOrg() {
  return process.env.SF_TARGET_ORG_ALIAS || "housie-dev";
}

export function runAiIteration(env = process.env) {
  let paths = [];
  let mode = env.DEPLOYMENT_MODE || "standard";
  let testMode = env.TEST_MODE || "none";
  let status = "failed";
  try {
    if (env.CONFIRM_DEPLOYMENT !== "DEPLOY") throw new Error("Type DEPLOY to authorize this iteration deployment.");
    if (!env.SOURCE_REF) throw new Error("Source ref is required.");
    if (!["standard", "fast"].includes(mode)) throw new Error("Unsupported deployment mode.");
    const tests = resolveTestSelection(testMode, env.APEX_TEST_CLASSES_INPUT);
    if (mode === "fast" && tests.mode !== "none") throw new Error("Fast mode requires test_mode=none.");
    paths = resolveMetadataPaths(env.SOURCE_PATHS_INPUT, { trackedFiles: trackedFiles(process.cwd()) });
    const org = targetOrg();
    if (mode === "standard") deployPaths(paths, org, true);
    deployPaths(paths, org, false);
    if (mode === "standard") runApexTests(tests, org);
    status = "completed";
  } finally {
    appendSummary([
      "### Salesforce AI iteration deployment",
      "- Result: " + status,
      "- Source ref: " + (env.SOURCE_REF || "unknown"),
      "- Commit: " + (() => { try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { return "unknown"; } })(),
      "- Deployment mode: " + mode,
      "- Test mode: " + testMode,
      "- Selected paths:",
      ...paths.map(item => "- `" + item + "`")
    ]);
  }
}

export function runRestore(env = process.env) {
  let paths = [];
  let status = "failed";
  try {
    if (env.CONFIRM_RESTORE !== "RESTORE") throw new Error("Type RESTORE to authorize this recovery deployment.");
    if (!env.RESTORE_REF) throw new Error("A known-good restore ref is required.");
    paths = resolveMetadataPaths(env.SOURCE_PATHS_INPUT, { trackedFiles: trackedFiles(process.cwd()) });
    const org = targetOrg();
    deployPaths(paths, org, true);
    deployPaths(paths, org, false);
    if (env.RUN_LOCAL_TESTS === "true") runApexTests({ mode: "local", classes: [] }, org);
    status = "completed";
  } finally {
    appendSummary([
      "### Salesforce AI iteration restore",
      "- Result: " + status,
      "- Restore ref: " + (env.RESTORE_REF || "unknown"),
      "- Commit: " + (() => { try { return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(); } catch { return "unknown"; } })(),
      "- Selected paths:",
      ...paths.map(item => "- `" + item + "`")
    ]);
  }
}

export function runRelease(env = process.env) {
  if (env.CONFIRM_DEPLOYMENT !== "DEPLOY") throw new Error("Deployment not authorized. Type DEPLOY to continue.");
  const manifest = resolveManifestPath(env.DEPLOYMENT_SCOPE);
  const org = targetOrg();
  deployManifest(manifest, org, true);
  runApexTests({ mode: "local", classes: [] }, org);
  deployManifest(manifest, org, false);
  runApexTests({ mode: "local", classes: [] }, org);
}

export function runManualValidation(env = process.env) {
  const manifest = resolveManifestPath(env.MANIFEST_SCOPE, env.CUSTOM_MANIFEST);
  const org = targetOrg();
  deployManifest(manifest, org, true);
  if (env.RUN_APEX_TESTS === "true") runApexTests({ mode: "local", classes: [] }, org);
}

export function runPrValidation(env = process.env) {
  const org = targetOrg();
  deployManifest("manifest/package.xml", org, true);
  runApexTests({ mode: "local", classes: [] }, org);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const action = process.argv[2];
  const actions = {
    "ai-iteration": runAiIteration,
    restore: runRestore,
    release: runRelease,
    "manual-validation": runManualValidation,
    "pr-validation": runPrValidation
  };
  if (!actions[action]) throw new Error("Usage: salesforce-deploy.mjs <ai-iteration|restore|release|manual-validation|pr-validation>");
  actions[action]();
}
