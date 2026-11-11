import fs from "node:fs";
import path from "node:path";

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
      throw new Error("Rejected path: " + item);
    }
    const absolute = path.resolve(workspace, item);
    const stat = fs.lstatSync(absolute);
    const real = fs.realpathSync(absolute);
    if (stat.isSymbolicLink() || !inside(forceRoot, real)) throw new Error("Path escapes force-app/: " + item);
    if (stat.isFile()) {
      if (!tracked.has(item)) throw new Error("Path is not tracked in the selected ref: " + item);
      const companion = item + "-meta.xml";
      if ((item.endsWith(".cls") || item.endsWith(".trigger")) && tracked.has(companion) && !seen.has(companion)) {
        seen.add(companion);
        result.push(companion);
      }
    } else if (stat.isDirectory()) {
      if (![...tracked].some(file => file.startsWith(item + "/"))) throw new Error("Directory has no tracked source files: " + item);
    } else throw new Error("Metadata path must be a regular file or directory: " + item);
    if (!seen.has(item)) { seen.add(item); result.push(item); }
  }
  return result;
}
