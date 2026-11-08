import { defineScenario } from "../framework/scenario";

/** Minimal evidence-only scenario. No assertion or end-to-end flow is required. */
export default defineScenario({
  id: "capture-org-home",
  description: "Capture the configured Salesforce org landing page.",
  async run({ page, screenshot, log }) {
    log("Landing page loaded", { title: await page.title(), url: page.url() });
    await screenshot("org-home");
  }
});
