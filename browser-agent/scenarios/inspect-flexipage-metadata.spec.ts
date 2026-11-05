import { test, expect } from "../core";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

test("inspect deployed Lightning App Page metadata for Housie components", async ({ housie }) => {
  const projectRoot = path.resolve(process.cwd(), "..");
  const result = execFileSync("sf", [
    "project", "retrieve", "start",
    "--metadata", "FlexiPage",
    "--target-org", "housie-browser-agent",
    "--wait", "30",
    "--json"
  ], { cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

  const response = JSON.parse(result);
  expect(response.status, "Salesforce metadata retrieve should succeed").toBe(0);

  const pageDir = path.join(projectRoot, "force-app", "main", "default", "flexipages");
  const files = fs.existsSync(pageDir)
    ? fs.readdirSync(pageDir).filter(file => file.endsWith(".flexipage-meta.xml"))
    : [];
  const pages = files.map(file => {
    const xml = fs.readFileSync(path.join(pageDir, file), "utf8");
    const label = xml.match(/<masterLabel>([\s\S]*?)<\/masterLabel>/)?.[1] || file;
    const type = xml.match(/<type>([\s\S]*?)<\/type>/)?.[1] || "unknown";
    const components = [...xml.matchAll(/<componentName>([\s\S]*?)<\/componentName>/g)].map(match => match[1]);
    return { file, label, type, components };
  }).filter(page => /housie|house account/i.test(page.label + " " + page.file));

  housie.note("Retrieved Housie FlexiPages: " + JSON.stringify(pages, null, 2));
  expect(pages.length, "Developer Org should contain Housie App Page metadata").toBeGreaterThan(0);
  expect(
    pages.some(page => page.components.includes("c:housieAccountAdmin")),
    "At least one Housie Account Admin page should contain c:housieAccountAdmin"
  ).toBe(true);
});
