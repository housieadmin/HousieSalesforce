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

test("retrieve and inspect Housie ExperienceBundle, Network and FlexiPages", async ({ housie }) => {
  const projectRoot = path.resolve(process.cwd(), "..");
  const result = execFileSync("sf", [
    "project", "retrieve", "start",
    "--metadata", "ExperienceBundle",
    "--metadata", "Network",
    "--metadata", "FlexiPage",
    "--target-org", "housie-browser-agent",
    "--wait", "60",
    "--json"
  ], { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  const cleanOutput = result.replace(/\u001b\[[0-9;]*m/g, "").trim();
  const jsonStart = cleanOutput.indexOf("{");
  const response = JSON.parse(cleanOutput.slice(jsonStart));
  expect(response.status, "Salesforce metadata retrieve should succeed").toBe(0);

  const flexiDir = path.join(projectRoot, "force-app", "main", "default", "flexipages");
  const flexipages = filesUnder(flexiDir).filter(file => file.endsWith(".flexipage-meta.xml"));
  const pageDetails = flexipages.map(file => {
    const xml = fs.readFileSync(file, "utf8");
    return {
      file: path.relative(projectRoot, file),
      label: xml.match(/<masterLabel>([\s\S]*?)<\/masterLabel>/)?.[1] || "",
      type: xml.match(/<type>([\s\S]*?)<\/type>/)?.[1] || "",
      components: [...xml.matchAll(/<componentName>([\s\S]*?)<\/componentName>/g)].map(match => match[1])
    };
  }).filter(page => /housie|house account/i.test(page.label + " " + page.file));

  const experienceDir = path.join(projectRoot, "force-app", "main", "default", "experiences");
  const experienceFiles = filesUnder(experienceDir).filter(file => /\.json$|\.site-meta\.xml$/.test(file));
  const networkDir = path.join(projectRoot, "force-app", "main", "default", "networks");
  const networkFiles = filesUnder(networkDir).filter(file => file.endsWith(".network-meta.xml"));

  housie.note("Housie FlexiPages: " + JSON.stringify(pageDetails, null, 2));
  housie.note("ExperienceBundle files retrieved: " + experienceFiles.map(file => path.relative(projectRoot, file)).join(", "));
  housie.note("Network metadata files retrieved: " + networkFiles.map(file => path.relative(projectRoot, file)).join(", "));

  expect(pageDetails.length, "Developer Org should contain Housie App Page metadata").toBeGreaterThan(0);
  expect(
    pageDetails.some(page => page.components.includes("c:housieAccountAdmin")),
    "At least one Housie Account Admin page should contain c:housieAccountAdmin"
  ).toBe(true);
  expect(experienceFiles.length, "ExperienceBundle should now be retrievable after enabling the setting").toBeGreaterThan(0);
});
