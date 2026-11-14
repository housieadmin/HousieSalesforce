import fs from "node:fs";
import path from "node:path";

const inside = (root, candidate) => {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
};

export function resolveRetrieveSelection({ pathsInput = "", manifest = "manifest/package-retrieve.xml", root = process.cwd() } = {}) {
  const paths = String(pathsInput).split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  if (paths.length) {
    if (manifest && manifest !== "manifest/package-retrieve.xml") throw new Error("Specify component paths OR a manifest XML path, not both.");
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
  if (!/^manifest\/[A-Za-z0-9._/-]+\.xml$/.test(manifest) || manifest.includes("..") || manifest.includes("//")) {
    throw new Error("Manifest must be a safe XML path under manifest/.");
  }
  const manifestRoot = fs.realpathSync(path.join(root, "manifest"));
  const absolute = path.resolve(root, manifest);
  const stat = fs.lstatSync(absolute);
  const real = fs.realpathSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink() || !inside(manifestRoot, real)) throw new Error("Retrieve manifest not found or outside manifest/: " + manifest);
  return { mode: "manifest", manifest };
}
