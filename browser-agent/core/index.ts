import { test as base, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

type Diagnostic = { timestamp: string; type: string; message: string; url?: string; status?: number; method?: string };
export type HousieBrowser = {
  login(): Promise<void>;
  navigate(pathOrUrl: string): Promise<void>;
  openRecord(objectApiName: string, recordId: string): Promise<void>;
  screenshot(name: string): Promise<string>;
  note(message: string): void;
};
type Fixtures = { housie: HousieBrowser };
const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "scenario";
const safeUrl = (value: string) => {
  try {
    const url = new URL(value);
    for (const key of ["sid", "access_token", "token", "code", "frontdoor"]) {
      if (url.searchParams.has(key)) url.searchParams.set(key, "[REDACTED]");
    }
    return url.toString();
  } catch { return "[unparseable-url]"; }
};

export const test = base.extend<Fixtures>({
  housie: async ({ page }, use, testInfo) => {
    const events: Diagnostic[] = [];
    const root = path.resolve(process.env.BROWSER_AGENT_ARTIFACT_DIR || "artifacts/local-run");
    const name = safe(path.basename(testInfo.file) + "-" + testInfo.titlePath.join("-"));
    const record = (type: string, message: string, extra: Partial<Diagnostic> = {}) =>
      events.push({ timestamp: new Date().toISOString(), type, message, ...extra });

    page.on("console", m => { if (m.type() === "error") record("console-error", m.text()); });
    page.on("pageerror", e => record("page-error", e.message));
    page.on("requestfailed", r => record("request-failed", r.failure()?.errorText || "Request failed", { url: safeUrl(r.url()), method: r.method() }));
    page.on("response", r => {
      if (r.status() >= 400) record("http-error", "HTTP " + r.status(), { url: safeUrl(r.url()), status: r.status(), method: r.request().method() });
    });

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
      async openRecord(objectApiName, recordId) {
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(objectApiName)) {
          throw new Error("Invalid Salesforce object API name: " + objectApiName);
        }
        if (!/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/.test(recordId)) {
          throw new Error("Invalid Salesforce record ID; expected 15 or 18 alphanumeric characters.");
        }
        await this.navigate("/lightning/r/" + encodeURIComponent(objectApiName) + "/" + encodeURIComponent(recordId) + "/view");
      },
      async screenshot(label) {
        const dir = path.join(root, "screenshots", name);
        await fs.mkdir(dir, { recursive: true });
        const file = path.join(dir, safe(label) + ".png");
        await page.screenshot({ path: file, fullPage: true });
        await testInfo.attach(label, { path: file, contentType: "image/png" });
        return file;
      },
      note(message) { record("scenario-note", message); }
    };

    await use(housie);
    const dir = path.join(root, "diagnostics");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, name + ".json");
    await fs.writeFile(file, JSON.stringify({ title: testInfo.title, file: testInfo.file, status: testInfo.status, events }, null, 2));
    await testInfo.attach("browser-diagnostics", { path: file, contentType: "application/json" });
  }
});
export { expect };
