import { test, expect } from "../core";

const playerUrl = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/housie-account/a00g500001DFWqoAAH/housie-test-user-3";
const regressionBoardName = "Transaction Regression - test-user-3";

test("withdraw active WAITING tickets, release the hold, then purchase again", async ({ page, housie }) => {
  await housie.navigate(playerUrl);
  const hub = page.locator("c-housie-board-hub");
  await expect(hub, "The public account page should render Board Hub").toHaveCount(1, { timeout: 60000 });

  const card = hub.locator("article.board-card").filter({ hasText: regressionBoardName }).first();
  await expect(card, "The dedicated transaction regression board must already exist").toBeVisible({ timeout: 60000 });
  await expect(card, "Withdrawal is only valid while the current game is WAITING").toContainText("Game: WAITING");

  let before = await card.innerText();
  let beforeCount = Number(before.match(/Active tickets:\s*(\d+)/)?.[1] || 0);
  if (beforeCount === 0) {
    const buy = card.getByRole("button", { name: /Buy ticket/ });
    await expect(buy, "An empty WAITING fixture must permit a seed purchase").toBeVisible();
    await buy.click();
    await expect.poll(async () => await card.innerText(), { timeout: 60000 })
      .toMatch(/Active tickets:\s*[1-9]/);
    before = await card.innerText();
    beforeCount = Number(before.match(/Active tickets:\s*(\d+)/)?.[1] || 0);
  }
  const beforeIds = [...before.matchAll(/(?:MANUAL|AUTO)\s*·\s*[0-9.]+\s*points\s*·\s*([a-f0-9]{32})/gi)].map(match => match[1]);
  expect(beforeCount, "The regression fixture must have an active ticket before withdrawal").toBeGreaterThan(0);

  const withdraw = card.getByRole("button", { name: "Withdraw from waiting game", exact: true });
  await expect(withdraw).toBeVisible();
  await withdraw.click();

  await expect.poll(async () => await card.innerText(), { timeout: 60000 })
    .toMatch(/Withdrawal|withdrawn|No active tickets|Buy ticket/i);
  await expect(card.getByText(/Active tickets:\s*[1-9]/)).toHaveCount(0, { timeout: 60000 });
  await expect(card.getByRole("button", { name: "Withdraw from waiting game", exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: /Buy ticket/ })).toBeVisible({ timeout: 30000 });

  const afterWithdrawal = await card.innerText();
  housie.note("Post-withdrawal board state: " + afterWithdrawal.slice(0, 2500));
  await housie.screenshot("waiting-ticket-withdrawn");

  await card.getByRole("button", { name: /Buy ticket/ }).click();
  await expect.poll(async () => await card.innerText(), { timeout: 60000 })
    .toMatch(/Ticket:\s*[a-f0-9]{32}/i);
  const afterRepurchase = await card.innerText();
  const afterIds = [...afterRepurchase.matchAll(/(?:MANUAL|AUTO)\s*·\s*[0-9.]+\s*points\s*·\s*([a-f0-9]{32})/gi)].map(match => match[1]);
  const newTicketId = afterRepurchase.match(/Ticket:\s*([a-f0-9]{32})/i)?.[1] || afterIds.find(id => !beforeIds.includes(id));
  expect(newTicketId, "A new active ticket should be created after withdrawal releases the original hold").toMatch(/^[a-f0-9]{32}$/i);
  expect(beforeIds, "The replacement ticket must not reuse a withdrawn ticket ID").not.toContain(newTicketId);
  await expect(card.getByRole("button", { name: /Finish ticket purchase|Finish withdrawal/ })).toHaveCount(0);
  await housie.screenshot("waiting-ticket-repurchased");
  housie.note("Withdrawal and subsequent purchase completed; prior active ticket IDs=" + beforeIds.join(",") + "; replacement=" + newTicketId);
});
