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

test("round-trip all Housie custom objects in Salesforce DX source format", async ({ housie }) => {
  const projectRoot = path.resolve(process.cwd());
  const expectedRoot = path.resolve(projectRoot, "..", ".browser-agent-source", "force-app", "main", "default", "objects");
  const retrieveRoot = path.join(projectRoot, "force-app", "main", "default", "objects");
  const objects = [
    "Account_Resource_Transaction__b", "Audit_Record__b", "Board_Member__b", "Board__b",
    "Bot_Contribution__b", "Chat_Message__b", "Claim__b", "Game_Action_Request__b",
    "Game_Action_Response__b", "Game_Event__b", "Game_Ledger__b", "Game_Participant__b",
    "Game__b", "Housie_Account__c", "Housie_Game_Command_Lock__c",
    "Housie_Operation_Lock__c", "Housie_Ticket_Command__c", "Operation_Journal__b",
    "Ticket__b", "Wallet_Hold__b"
  ];
  const manifestPath = path.join(projectRoot, "manifest", "housie-objects-roundtrip.xml");
  const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
${objects.map(name => "    <members>" + name + "</members>").join("\n")}
    <name>CustomObject</name>
  </types>
  <version>66.0</version>
</Package>`;
  fs.writeFileSync(manifestPath, manifest);

  const output = execFileSync("sf", [
    "project", "retrieve", "start", "--manifest", manifestPath,
    "--target-org", "housie-browser-agent", "--wait", "60", "--json"
  ], { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const clean = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
  const response = JSON.parse(clean.slice(clean.indexOf("{")));
  expect(response.status, "Org metadata retrieve should succeed").toBe(0);

  const expectedFiles = filesUnder(expectedRoot).map(file => path.relative(expectedRoot, file)).sort();
  const actualFiles = filesUnder(retrieveRoot).map(file => path.relative(retrieveRoot, file)).sort();
  const missing = expectedFiles.filter(file => !actualFiles.includes(file));
  const unexpected = actualFiles.filter(file => !expectedFiles.includes(file));
  const different = expectedFiles.filter(file => actualFiles.includes(file) &&
    !fs.readFileSync(path.join(expectedRoot, file)).equals(fs.readFileSync(path.join(retrieveRoot, file))));

  housie.note(JSON.stringify({
    expectedFiles: expectedFiles.length,
    retrievedFiles: actualFiles.length,
    missing,
    unexpected,
    different
  }, null, 2));

  expect(missing, "Retrieved org metadata should not be missing source files").toEqual([]);
  expect(unexpected, "Retrieved org metadata should not add untracked object files").toEqual([]);
  expect(different, "Repository metadata should match the org retrieve byte-for-byte").toEqual([]);
  expect(expectedFiles.length).toBe(249);
});
