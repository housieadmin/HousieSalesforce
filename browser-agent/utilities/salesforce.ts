import { execFileSync } from "node:child_process";
import path from "node:path";
import type { Page } from "@playwright/test";

/** Opens an authenticated Lightning route using the configured Salesforce CLI org alias. */
export async function openLightningTab(
  page: Page,
  lightningPath: string,
  targetOrg = "housie-browser-agent"
): Promise<void> {
  if (!lightningPath.startsWith("/lightning/")) {
    throw new Error("Expected a Lightning route beginning with /lightning/.");
  }
  const projectRoot = path.resolve(process.cwd(), "..");
  const output = execFileSync("sf", [
    "org", "open", "--url-only", "--path", lightningPath,
    "--target-org", targetOrg, "--json"
  ], { cwd: projectRoot, encoding: "utf8" });
  const clean = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
  const start = clean.indexOf("{");
  if (start < 0) throw new Error("Salesforce CLI did not return JSON for the frontdoor URL.");
  const result = JSON.parse(clean.slice(start));
  const url = result?.result?.url;
  if (typeof url !== "string" || !/^https:\/\//.test(url)) {
    throw new Error("Salesforce CLI did not return a valid frontdoor URL.");
  }
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(error => {
    if (!String(error).includes("ERR_ABORTED")) throw error;
  });
}

/** Redacts the account bearer key in the live DOM before assertions or artifacts. */
export async function redactAccountKey(page: Page): Promise<void> {
  const keyLine = page.getByText(/Account key:/);
  await keyLine.waitFor({ state: "visible", timeout: 60000 });
  await keyLine.evaluate(element => { element.textContent = "Account key: [REDACTED]"; });
}

export interface AuraResponseSummary {
  status: number;
  errors: string[];
}

/** Capture concise Aura action errors for browser diagnostics without retaining request credentials. */
export function captureAuraErrors(page: Page): {
  snapshot(): Promise<AuraResponseSummary[]>;
  stop(): void;
} {
  const pending: Promise<AuraResponseSummary>[] = [];
  const onResponse = (response: import("@playwright/test").Response) => {
    if (!/\/sfsites\/aura(?:\?|$)/.test(response.url()) || response.request().method() !== "POST") return;
    pending.push((async () => {
      const entry: AuraResponseSummary = { status: response.status(), errors: [] };
      try {
        const payload = JSON.parse(await response.text());
        const visit = (value: unknown): void => {
          if (!value || typeof value !== "object") return;
          if (Array.isArray(value)) { value.forEach(visit); return; }
          const record = value as Record<string, unknown>;
          for (const key of ["message", "exceptionMessage", "errorCode", "state"]) {
            const candidate = record[key];
            if (typeof candidate === "string" &&
              /error|exception|fail|invalid|denied|not enough|limit|required/i.test(candidate)) {
              entry.errors.push(key + ": " + candidate.slice(0, 1200));
            }
          }
          Object.values(record).forEach(visit);
        };
        visit(payload);
      } catch (error) {
        entry.errors.push("Unable to parse Aura response: " + String(error).slice(0, 250));
      }
      return entry;
    })());
    if (pending.length > 100) pending.splice(0, pending.length - 100);
  };
  page.on("response", onResponse);
  return {
    async snapshot() { return Promise.all(pending); },
    stop() { page.off("response", onResponse); }
  };
}
