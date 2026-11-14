import { getFrontdoorUrl } from "./get-frontdoor-url.js";

export async function openLightningTab(page, lightningPath, options = {}) {
  if (!page || typeof page.goto !== "function") throw new Error("A Playwright-compatible page is required.");
  if (typeof lightningPath !== "string" || !lightningPath.startsWith("/lightning/")) {
    throw new Error("Expected a Lightning route beginning with /lightning/.");
  }
  const url = getFrontdoorUrl({ ...options, lightningPath });
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeout ?? 60000 }).catch(error => {
    if (!String(error).includes("ERR_ABORTED")) throw error;
  });
}
