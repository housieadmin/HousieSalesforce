import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
};

export function resolveRetrieveSelection({ pathsInput = "", manifest = "manifest/package-retrieve.xml", root = process.cwd() }) {
  const paths = String(pathsInput).split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  if (paths.length) {
    if (manifest && manifest !== "manifest/package-retrieve.xml") {
      throw new Error("Specify component paths OR a manifest XML path, not both.");
    }
    const workspace = fs.realpathSync(root);
    const forceRoot = fs.realpathSync(path.join(workspace, "force-app"));
    const selected = [];
    const seen = new Set();
    for (const item of paths) {
      if (!/^force-app\/[A-Za-z0-9._/-]+$/.test(item) || item.includes("..") || item.includes("//") || item.endsWith("/")) {
        throw new Error("Invalid component path: " + item);
      }
      const absolute = path.resolve(workspace, item);
      const stat = fs.lstatSync(absolute);
      const real = fs.realpathSync(absolute);
      if (stat.isSymbolicLink() || !inside(forceRoot, real) || (!stat.isFile() && !stat.isDirectory())) {
        throw new Error("Component path escapes force-app/: " + item);
      }
      if (!seen.has(item)) { seen.add(item); selected.push(item); }
    }
    return { mode: "source", paths: selected };
  }
  const selectedManifest = manifest || "manifest/package-retrieve.xml";
  if (!/^manifest\/[A-Za-z0-9._/-]+\.xml$/.test(selectedManifest) || selectedManifest.includes("..") || selectedManifest.includes("//")) {
    throw new Error("Manifest must be a safe XML path under manifest/.");
  }
  const manifestRoot = fs.realpathSync(path.join(root, "manifest"));
  const absolute = path.resolve(root, selectedManifest);
  const stat = fs.lstatSync(absolute);
  const real = fs.realpathSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || !inside(manifestRoot, real)) {
    throw new Error("Retrieve manifest not found or outside manifest/: " + selectedManifest);
  }
  return { mode: "manifest", manifest: selectedManifest };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", env: process.env, ...options });
  if (result.error) throw new Error("Unable to start " + command + ".");
  if (result.status !== 0) throw new Error(command + " command failed: " + args.slice(0, 3).join(" "));
}

function appendSummary(lines) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}

export function runOrgSync(env = process.env) {
  if (env.CONFIRM_SYNC !== "SYNC") throw new Error("Type SYNC to authorize retrieval.");
  const selection = resolveRetrieveSelection({
    pathsInput: env.RETRIEVE_PATHS_INPUT,
    manifest: env.RETRIEVE_MANIFEST || "manifest/package-retrieve.xml"
  });
  const targetOrg = env.SF_TARGET_ORG_ALIAS || "housie-dev";
  if (selection.mode === "manifest") {
    run("sf", ["project", "retrieve", "start", "--manifest", selection.manifest, "--target-org", targetOrg, "--wait", "60"]);
  } else {
    const args = ["project", "retrieve", "start"];
    for (const item of selection.paths) args.push("--source-dir", item);
    run("sf", [...args, "--target-org", targetOrg, "--wait", "60"]);
  }
  const changed = execFileSync("git", ["status", "--porcelain", "--", "force-app"], { encoding: "utf8" }).trim().length > 0;
  if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, "changed=" + changed + "\n");
  const writeSummary = () => appendSummary([
    "### Salesforce org metadata retrieve",
    "- Result: completed",
    "- Changes detected: " + changed,
    "- Pull request requested: " + (env.CREATE_PR === "true"),
    "- Selection: " + (selection.mode === "manifest" ? selection.manifest : selection.paths.join(", ")),
    "- Description: " + (env.RUN_DESCRIPTION || "Not provided")
  ]);
  if (!changed || env.CREATE_PR !== "true") {
    writeSummary();
    return { changed, selection };
  }
  const branch = "automation/org-retrieve-" + String(env.GITHUB_RUN_ID || Date.now()).replace(/[^0-9]/g, "");
  run("git", ["config", "user.name", "github-actions[bot]"]);
  run("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
  run("git", ["switch", "-c", branch]);
  run("git", ["add", "force-app/"]);
  run("git", ["commit", "-m", "chore: retrieve metadata from Salesforce org"]);
  run("git", ["push", "origin", branch]);
  const chosen = selection.mode === "manifest" ? selection.manifest : selection.paths.join(", ");
  const body = [
    "Automated Salesforce metadata retrieval.",
    "",
    "Selection: " + chosen,
    "Description: " + (env.RUN_DESCRIPTION || "Not provided"),
    "",
    "Review the full diff carefully. Retrieved metadata is proposed through this PR and is never written directly to main."
  ].join("\n");
  run("gh", ["pr", "create", "--base", "main", "--head", branch, "--title", "Retrieve Salesforce metadata from org", "--body", body]);
  writeSummary();
  return { changed, selection, branch };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) runOrgSync();
