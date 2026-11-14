import fs from "node:fs";
import path from "node:path";

const scopes = {
  application: "manifest/package.xml",
  "org-setup": "manifest/package-org-setup.xml",
  experience: "manifest/package-experience.xml"
};

export function resolveManifestPath(scope, customManifest, { root = process.cwd() } = {}) {
  const selected = scope === "custom" ? String(customManifest || "") : scopes[scope];
  if (!selected || !/^manifest\/[A-Za-z0-9._/-]+\.xml$/.test(selected) || selected.includes("..") || selected.includes("//")) {
    throw new Error("Manifest must be a safe XML path under manifest/.");
  }
  const directory = fs.realpathSync(path.join(root, "manifest"));
  const absolute = path.resolve(root, selected);
  const stat = fs.lstatSync(absolute);
  const real = fs.realpathSync(absolute);
  const relative = path.relative(directory, real);
  if (!stat.isFile() || stat.isSymbolicLink() || !relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Manifest not found or outside manifest/: " + selected);
  }
  return selected;
}
