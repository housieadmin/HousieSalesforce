import { test, expect } from "../core";

const site = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s";
const playerUrl = site + "/housie-account/a00g500001D7iIrAAJ/housie-test-user-2";

test("public test-user ticket purchase reports exact failing transaction stage", async ({ page, housie }) => {
  await housie.navigate(playerUrl);
  const hub = page.locator("c-housie-board-hub");
  await expect(hub, "Public account page should render Board Hub").toHaveCount(1, { timeout: 60000 });
  await expect(hub.getByText("Your boards", { exact: true })).toBeVisible({ timeout: 60000 });

  const purchase = hub.getByRole("button", { name: /Buy ticket/ }).first();
  await expect(purchase, "A waiting game must be available for this account").toBeVisible({ timeout: 30000 });
  await purchase.click();

  await expect.poll(async () => await hub.innerText(), { timeout: 60000 }).toMatch(/Ticket:|Ticket purchase failed during/);
  const result = await hub.innerText();
  housie.note("Ticket purchase UI result: " + result.slice(0, 1500));
  await housie.screenshot("ticket-purchase-stage-diagnostic");
  expect(result, "Ticket purchase must complete without a transaction-stage error").toMatch(/Ticket:/);
});
