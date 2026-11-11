import { test as base, expect } from "@playwright/test";
import { captureBrowserDiagnostics } from "sf-augment";
import fs from "node:fs/promises";
import path from "node:path";

export type HousieBrowser = {
  login(): Promise<void>;
  navigate(pathOrUrl: string): Promise<void>;
  screenshot(name: string): Promise<string>;
  note(message: string): void;
};
type Fixtures = { housie: HousieBrowser };
const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "scenario";

export const test = base.extend<Fixtures>({
  housie: async ({ page }, use, testInfo) => {
    const diagnostics = captureBrowserDiagnostics(page);
    const root = path.resolve(process.env.BROWSER_AGENT_ARTIFACT_DIR || "artifacts/local-run");
    const name = safe(path.basename(testInfo.file) + "-" + testInfo.titlePath.join("-"));

    const housie: HousieBrowser = {
      async login() {
        const url = process.env.HOUSIE_START_URL;
        if (!url) throw new Error("HOUSIE_START_URL is missing; workflow authentication did not complete.");
        await page.goto(url, { waitUntil: "domcontentloaded" });
      },
      async navigate(value) {
        const baseUrl = new URL(page.url()).origin + "/";
        const target = /^https?:\/\//i.test(value) ? value : new URL(value.replace(/^\//, ""), baseUrl).toString();
        await page.goto(target, { waitUntil: "domcontentloaded" });
      },
      async screenshot(label) {
        const dir = path.join(root, "screenshots", name);
        await fs.mkdir(dir, { recursive: true });
        const file = path.join(dir, safe(label) + ".png");
        await page.screenshot({ path: file, fullPage: true });
        await testInfo.attach(label, { path: file, contentType: "image/png" });
        return file;
      },
      note(message) { diagnostics.note(message); }
    };

    try {
      await use(housie);
    } finally {
      diagnostics.stop();
      const dir = path.join(root, "diagnostics");
      await fs.mkdir(dir, { recursive: true });
      const file = path.join(dir, name + ".json");
      await fs.writeFile(file, JSON.stringify({
        title: testInfo.title,
        file: testInfo.file,
        status: testInfo.status,
        events: diagnostics.snapshot()
      }, null, 2));
      await testInfo.attach("browser-diagnostics", { path: file, contentType: "application/json" });
    }
  }
});
export { expect };
