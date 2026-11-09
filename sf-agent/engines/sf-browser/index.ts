import {
  chromium,
  firefox,
  webkit,
  type Browser,
  type BrowserContext,
  type Page
} from "playwright";
import type { EnginePlugin, EngineRuntime, JsonObject } from "@sf-agent/core";

export interface SfBrowserOptions {
  browser?: "chromium" | "firefox" | "webkit";
  headless?: boolean;
  baseUrl?: string;
  timeoutMs?: number;
}

export class SfBrowserEngine {
  private browser?: Browser;
  private context?: BrowserContext;
  private page?: Page;

  constructor(
    private readonly options: SfBrowserOptions = {},
    private readonly runtime?: EngineRuntime
  ) {}

  async start(): Promise<Page> {
    if (this.page) return this.page;

    const engine = this.options.browser === "firefox"
      ? firefox
      : this.options.browser === "webkit" ? webkit : chromium;

    this.browser = await engine.launch({ headless: this.options.headless ?? true });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(this.options.timeoutMs ?? 30_000);

    this.page.on("console", message => {
      if (message.type() === "error") {
        this.runtime?.log.warn("Browser console error.", { message: message.text().slice(0, 1000) });
      }
    });
    this.page.on("pageerror", error => {
      this.runtime?.log.warn("Browser page error.", { message: error.message.slice(0, 1000) });
    });

    return this.page;
  }

  async goto(urlOrPath: string): Promise<void> {
    const page = await this.start();
    let target: URL;

    if (/^https?:\/\//i.test(urlOrPath)) {
      target = new URL(urlOrPath);
    } else {
      if (!this.options.baseUrl) {
        throw new Error("A baseUrl is required when navigating with a relative path.");
      }
      const base = this.options.baseUrl.endsWith("/") ? this.options.baseUrl : `${this.options.baseUrl}/`;
      target = new URL(urlOrPath.replace(/^\//, ""), base);
    }

    if (target.protocol !== "http:" && target.protocol !== "https:") {
      throw new Error("Browser navigation is restricted to HTTP and HTTPS URLs.");
    }
    await page.goto(target.toString(), { waitUntil: "domcontentloaded" });
  }

  async screenshot(name: string): Promise<Buffer> {
    const bytes = await (await this.start()).screenshot({ fullPage: true });
    await this.runtime?.evidence.attach(name, bytes, "image/png");
    return bytes;
  }

  getPage(): Page {
    if (!this.page) throw new Error("Call start() before getPage().");
    return this.page;
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
    this.page = undefined;
    this.context = undefined;
    this.browser = undefined;
  }
}

export function createPlugin(options: JsonObject = {}): EnginePlugin<SfBrowserOptions, SfBrowserEngine> {
  return {
    id: "sf-browser",
    create(_pluginOptions, runtime) {
      return new SfBrowserEngine(options as SfBrowserOptions, runtime);
    }
  };
}
