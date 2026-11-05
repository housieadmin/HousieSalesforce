import { test, expect } from "../core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? filesUnder(full) : [full];
  });
}

function retrieve(projectRoot: string, manifestName: string): void {
  const manifestPath = path.join(projectRoot, "manifest", manifestName);
  const output = execFileSync("sf", [
    "project", "retrieve", "start", "--manifest", manifestPath,
    "--target-org", "housie-browser-agent", "--wait", "60", "--json"
  ], { cwd: projectRoot, encoding: "utf8" });
  const clean = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
  const start = clean.indexOf("{");
  if (start < 0) throw new Error("Salesforce retrieve did not return JSON: " + output.slice(-1000));
  const response = JSON.parse(clean.slice(start));
  if (response.status !== 0) throw new Error("Salesforce metadata retrieve failed: " + JSON.stringify(response));
}

function compare(expectedRoot: string, actualRoot: string, ignore: string[] = []) {
  const expected = filesUnder(expectedRoot).map(file => path.relative(expectedRoot, file)).filter(file => !ignore.includes(file)).sort();
  const actual = filesUnder(actualRoot).map(file => path.relative(actualRoot, file)).filter(file => !ignore.includes(file)).sort();
  const missing = expected.filter(file => !actual.includes(file));
  const unexpected = actual.filter(file => !expected.includes(file));
  const different = expected.filter(file => actual.includes(file) &&
    !fs.readFileSync(path.join(expectedRoot, file)).equals(fs.readFileSync(path.join(actualRoot, file))));
  return { expected: expected.length, actual: actual.length, missing, unexpected, different };
}

/** Isolate a retrieve from pre-existing runtime files so missing org metadata cannot false-pass. */
function retrieveAndCompare(projectRoot: string, manifest: string, sourceRoot: string,
  runtimeRoot: string, component: string, ignore: string[] = []) {
  const target = path.join(runtimeRoot, component);
  const backupRoot = fs.mkdtempSync(path.join(os.tmpdir(), "housie-org-roundtrip-"));
  const backup = path.join(backupRoot, component);
  const hadOriginal = fs.existsSync(target);
  if (hadOriginal) fs.renameSync(target, backup);
  try {
    retrieve(projectRoot, manifest);
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive: true });
    return compare(path.join(sourceRoot, component), target, ignore);
  } finally {
    fs.rmSync(target, { recursive: true, force: true });
    if (hadOriginal) fs.renameSync(backup, target);
    fs.rmSync(backupRoot, { recursive: true, force: true });
  }
}

test("reconcile only Housie-owned Apex and LWC source against the Developer Org", async ({ housie }) => {
  const projectRoot = path.resolve(process.cwd(), "..");
  const sourceRoot = path.resolve(projectRoot, "..", ".browser-agent-source", "force-app", "main", "default");
  const runtimeRoot = path.join(projectRoot, "force-app", "main", "default");

  const apex = retrieveAndCompare(projectRoot, "package-housie-apex.xml",
    sourceRoot, runtimeRoot, "classes");

  const lwc = retrieveAndCompare(projectRoot, "package-housie-lwc.xml",
    sourceRoot, runtimeRoot, "lwc", ["jsconfig.json"]);

  const customPermissions = retrieveAndCompare(projectRoot, "package-housie-access.xml",
    sourceRoot, runtimeRoot, "customPermissions");
  const permissionSets = retrieveAndCompare(projectRoot, "package-housie-access.xml",
    sourceRoot, runtimeRoot, "permissionsets");
  const tabs = retrieveAndCompare(projectRoot, "package-housie-access.xml",
    sourceRoot, runtimeRoot, "tabs");

  housie.note(JSON.stringify({ apex, lwc, customPermissions, permissionSets, tabs }, null, 2));
  expect(apex.missing, "Org should contain every curated Housie Apex source file").toEqual([]);
  expect(apex.unexpected, "Curated Apex retrieve should not include unrelated classes").toEqual([]);
  expect(apex.different, "Housie Apex source should match the Developer Org byte-for-byte").toEqual([]);
  expect(lwc.missing, "Org should contain every curated Housie LWC source file").toEqual([]);
  expect(lwc.unexpected, "Curated LWC retrieve should not include unrelated components").toEqual([]);
  expect(lwc.different, "Housie LWC source should match the Developer Org byte-for-byte").toEqual([]);
  for (const [name, result] of Object.entries({ customPermissions, permissionSets, tabs })) {
    expect(result.missing, name + " should contain every curated source file").toEqual([]);
    expect(result.unexpected, name + " retrieve should not include unrelated metadata").toEqual([]);
    expect(result.different, name + " source should match the Developer Org byte-for-byte").toEqual([]);
  }
});
