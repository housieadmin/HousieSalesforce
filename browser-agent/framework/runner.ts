import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import type { BrowserAgentConfig } from "./config";
import type { ScenarioContext, ScenarioDefinition, WorkflowDefinition } from "./scenario";

type Runnable = ScenarioDefinition | WorkflowDefinition;
type EventRecord = { at: string; level: string; message: string; details?: Record<string, unknown> };

const safeName = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "scenario";

function redact(value: string): string {
  let output = value;
  for (const [name, secret] of Object.entries(process.env)) {
    if (secret && secret.length > 5 && /(?:SECRET|TOKEN|KEY|PASSWORD|CLIENT_ID|USERNAME)/i.test(name)) {
      output = output.split(secret).join("[REDACTED]");
    }
  }
  const startUrl = process.env.BROWSER_AGENT_START_URL;
  if (startUrl && startUrl.length > 5) output = output.split(startUrl).join("[REDACTED]");
  return output
    .replace(/([?&](?:sid|session|access_token|refresh_token|token|code|frontdoor)=)[^&#\s]*/gi, "$1[REDACTED]")
    .replace(/\b[a-f0-9]{32,}\b/gi, "[REDACTED_TOKEN]");
}

function redactDetails(value: unknown): unknown {
  if (typeof value === "string") return redact(value);
  if (Array.isArray(value)) return value.map(redactDetails);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactDetails(item)]));
  return value;
}

async function executeDefinition(definition: Runnable, context: ScenarioContext, events: EventRecord[]) {
  const steps = definition.kind === "workflow" ? definition.scenarios : [definition];
  for (const step of steps) {
    events.push({ at: new Date().toISOString(), level: "info", message: "scenario-start", details: { id: step.id } });
    await step.run(context);
    events.push({ at: new Date().toISOString(), level: "info", message: "scenario-complete", details: { id: step.id } });
  }
}

export async function runDefinition(definition: Runnable, config: BrowserAgentConfig): Promise<{ status: "completed" | "failed"; artifactDir: string }> {
  const runDir = path.join(config.artifactsDir, safeName(definition.id) + "-" + new Date().toISOString().replace(/[:.]/g, "-"));
  const screenshotsDir = path.join(runDir, "screenshots");
  await fs.mkdir(screenshotsDir, { recursive: true });
  const events: EventRecord[] = [];
  let browser: Browser | undefined;
  let browserContext: BrowserContext | undefined;
  let page: Page | undefined;
  let failure: string | undefined;
  let traceStarted = false;
  const record = (level: string, message: string, details?: Record<string, unknown>) => {
    events.push({ at: new Date().toISOString(), level, message: redact(message), ...(details ? { details: redactDetails(details) as Record<string, unknown> } : {}) });
  };

  try {
    browser = await chromium.launch({ headless: config.headless, slowMo: config.slowMo });
    browserContext = await browser.newContext({ viewport: config.viewport });
    if (config.traceOnFailure) {
      await browserContext.tracing.start({ screenshots: true, snapshots: true, sources: true });
      traceStarted = true;
    }
    page = await browserContext.newPage();
    page.setDefaultNavigationTimeout(config.navigationTimeoutMs);
    page.setDefaultTimeout(config.actionTimeoutMs);

    page.on("console", message => {
      if (message.type() === "error") record("error", "browser-console", { text: redact(message.text()) });
    });
    page.on("pageerror", error => record("error", "page-error", { message: redact(error.message) }));
    page.on("requestfailed", request => record("error", "request-failed", {
      url: redact(request.url()), method: request.method(), error: redact(request.failure()?.errorText || "Request failed")
    }));
    page.on("response", response => {
      if (response.status() >= 400) record("warn", "http-error", {
        url: redact(response.url()), status: response.status(), method: response.request().method()
      });
    });

    const context: ScenarioContext = {
      page,
      config,
      async navigate(value) {
        const target = /^https?:\/\//i.test(value)
          ? value
          : config.baseUrl ? new URL(value.replace(/^\//, ""), config.baseUrl.endsWith("/") ? config.baseUrl : config.baseUrl + "/").toString()
            : (() => { throw new Error("Relative navigation requires baseUrl in browser-agent configuration."); })();
        await page!.goto(target, { waitUntil: "domcontentloaded" });
      },
      async screenshot(name) {
        const file = path.join(screenshotsDir, safeName(name) + ".png");
        await page!.screenshot({ path: file, fullPage: true });
        record("info", "screenshot", { file: path.relative(runDir, file) });
        return file;
      },
      log(message, details) { record("info", message, details); },
      note(message) { record("note", message); }
    };

    if (config.startUrl) await page.goto(config.startUrl, { waitUntil: "domcontentloaded" });
    await executeDefinition(definition, context, events);
  } catch (error) {
    failure = redact(error instanceof Error ? error.stack || error.message : String(error));
    record("error", "execution-failed", { error: failure });
    if (page) {
      try {
        const file = path.join(screenshotsDir, "failure.png");
        await page.screenshot({ path: file, fullPage: true, timeout: 10000 });
      } catch (screenshotError) {
        record("warn", "failure-screenshot-unavailable", { error: redact(String(screenshotError)) });
      }
    }
  } finally {
    if (browserContext && traceStarted) {
      try {
        if (failure) await browserContext.tracing.stop({ path: path.join(runDir, "failure-trace.zip") });
        else await browserContext.tracing.stop();
      } catch (traceError) {
        record("warn", "trace-finalization-failed", { error: redact(String(traceError)) });
      }
    }
    await browser?.close().catch(error => record("warn", "browser-close-failed", { error: redact(String(error)) }));
    await fs.writeFile(path.join(runDir, "events.json"), JSON.stringify(events, null, 2));
    await fs.writeFile(path.join(runDir, "result.json"), JSON.stringify({
      id: definition.id,
      kind: definition.kind,
      status: failure ? "failed" : "completed",
      description: definition.description,
      startedAt: events[0]?.at,
      finishedAt: new Date().toISOString(),
      error: failure
    }, null, 2));
  }

  return { status: failure ? "failed" : "completed", artifactDir: runDir };
}
