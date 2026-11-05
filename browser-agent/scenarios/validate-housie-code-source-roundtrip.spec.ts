import { test, expect } from "../core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
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

function compare(expectedRoot: string, actualRoot: string) {
  const expected = filesUnder(expectedRoot).map(file => path.relative(expectedRoot, file)).sort();
  const actual = filesUnder(actualRoot).map(file => path.relative(actualRoot, file)).sort();
  const missing = expected.filter(file => !actual.includes(file));
  const unexpected = actual.filter(file => !expected.includes(file));
  const different = expected.filter(file => actual.includes(file) &&
    !fs.readFileSync(path.join(expectedRoot, file)).equals(fs.readFileSync(path.join(actualRoot, file))));
  return { expected: expected.length, actual: actual.length, missing, unexpected, different };
}

test("reconcile only Housie-owned Apex and LWC source against the Developer Org", async ({ housie }) => {
  const projectRoot = path.resolve(process.cwd(), "..");
  const sourceRoot = path.resolve(projectRoot, "..", ".browser-agent-source", "force-app", "main", "default");
  const orgRoot = path.join(projectRoot, "force-app", "main", "default");

  retrieve(projectRoot, "package-housie-apex.xml");
  const apex = compare(path.join(sourceRoot, "classes"), path.join(orgRoot, "classes"));

  retrieve(projectRoot, "package-housie-lwc.xml");
  const lwc = compare(path.join(sourceRoot, "lwc"), path.join(orgRoot, "lwc"));

  housie.note(JSON.stringify({ apex, lwc }, null, 2));
  expect(apex.missing, "Org should contain every curated Housie Apex source file").toEqual([]);
  expect(apex.unexpected, "Curated Apex retrieve should not include unrelated classes").toEqual([]);
  expect(apex.different, "Housie Apex source should match the Developer Org byte-for-byte").toEqual([]);
  expect(lwc.missing, "Org should contain every curated Housie LWC source file").toEqual([]);
  expect(lwc.unexpected, "Curated LWC retrieve should not include unrelated components").toEqual([]);
  expect(lwc.different, "Housie LWC source should match the Developer Org byte-for-byte").toEqual([]);
});
