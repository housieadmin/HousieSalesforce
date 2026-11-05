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
    "--metadata", "CustomTab",
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
  const networkXml = networkFiles.length
    ? fs.readFileSync(networkFiles[0], "utf8")
    : "";
  const networkSetting = (name: string) => networkXml.match(new RegExp("<" + name + ">([\s\S]*?)</" + name + ">"))?.[1]?.trim() || "";
  const siteConfigPath = path.join(experienceDir, "Housie1", "config", "housie.json");
  const siteConfig = fs.existsSync(siteConfigPath)
    ? JSON.parse(fs.readFileSync(siteConfigPath, "utf8"))
    : {};

  const homeViewPath = path.join(experienceDir, "Housie1", "views", "home.json");
  const accountDetailViewPath = path.join(experienceDir, "Housie1", "views", "housieAccountDetail.json");
  const homeView = fs.existsSync(homeViewPath) ? JSON.parse(fs.readFileSync(homeViewPath, "utf8")) : {};
  const accountDetailView = fs.existsSync(accountDetailViewPath)
    ? JSON.parse(fs.readFileSync(accountDetailViewPath, "utf8"))
    : {};
  const homeComponents = (homeView.regions || []).flatMap(region => region.components || []).map(component => component.componentName);
  const accountDetailComponents = (accountDetailView.regions || []).flatMap(region => region.components || []);

  const tabPath = path.join(projectRoot, "force-app", "main", "default", "tabs", "Housie_Account_Admin.tab-meta.xml");
  const tabXml = fs.existsSync(tabPath) ? fs.readFileSync(tabPath, "utf8") : "";
  const tabFlexiPage = tabXml.match(/<flexiPage>([\s\S]*?)<\/flexiPage>/)?.[1] || "";
  housie.note("Housie FlexiPages: " + JSON.stringify(pageDetails, null, 2));
  housie.note("Housie_Account_Admin custom tab targets FlexiPage: " + tabFlexiPage);
  housie.note("ExperienceBundle files retrieved: " + experienceFiles.map(file => path.relative(projectRoot, file)).join(", "));
  housie.note("Network metadata files retrieved: " + networkFiles.map(file => path.relative(projectRoot, file)).join(", "));
  housie.note("Network metadata security settings: " + JSON.stringify({
    status: networkSetting("status"),
    senderAddress: networkSetting("emailSenderAddress"),
    guestFileAccess: networkSetting("enableGuestFileAccess"),
    guestMemberVisibility: networkSetting("enableGuestMemberVisibility"),
    guestChatter: networkSetting("enableGuestChatter"),
    selfRegistration: networkSetting("selfRegistration"),
    siteAvailableToGuests: siteConfig.isAvailableToGuests
  }));
  housie.note("ExperienceBundle root route components: " + JSON.stringify(homeComponents));
  housie.note("ExperienceBundle Housie Account Detail components: " + JSON.stringify(accountDetailComponents));


  expect(pageDetails.length, "Developer Org should contain Housie App Page metadata").toBeGreaterThan(0);
  expect(
    pageDetails.some(page => page.components.includes("housieAccountAdmin")),
    "At least one Housie Account Admin page should contain housieAccountAdmin"
  ).toBe(true);
  expect(experienceFiles.length, "ExperienceBundle should now be retrievable after enabling the setting").toBeGreaterThan(0);
  expect(tabFlexiPage, "Housie Account Admin custom tab should resolve to its configured FlexiPage").toBe("Housie_Account_Admin");
  expect(
    pageDetails.some(page => page.file.endsWith("/Housie_Account_Admin.flexipage-meta.xml") &&
      page.components.includes("housieAccountAdmin")),
    "The custom-tab target FlexiPage should contain the account admin component"
  ).toBe(true);
  expect(homeComponents).toContain("c:housieApp");
  expect(accountDetailComponents.some(component =>
    component.componentName === "c:housieBoardHub" &&
    component.componentAttributes?.recordId === "{!recordId}"
  ), "ExperienceBundle account-detail route must pass recordId to BoardHub").toBe(true);
  expect(siteConfig.isAvailableToGuests, "The public Housie root route must be guest available").toBe(true);
});
