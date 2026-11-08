import { defineScenario } from "../framework/scenario";

export default defineScenario({
  id: "inspect-org-home",
  description: "Collect basic information from the current Salesforce landing page.",
  async run({ page, log }) {
    log("Page inspection", {
      title: await page.title(),
      url: page.url(),
      bodyText: (await page.locator("body").innerText().catch(() => "")).slice(0, 2000)
    });
  }
});
