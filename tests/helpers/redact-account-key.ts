import type { Page } from "@playwright/test";

export async function redactAccountKey(page: Page, required = true): Promise<void> {
  const keyLine = page.getByText(/Account key:/).first();
  if (await keyLine.count() && await keyLine.isVisible().catch(() => false)) {
    await keyLine.evaluate(element => { element.textContent = "Account key: [REDACTED]"; });
    return;
  }
  if (required) {
    await keyLine.waitFor({ state: "visible", timeout: 60000 });
    await keyLine.evaluate(element => { element.textContent = "Account key: [REDACTED]"; });
  }
}
