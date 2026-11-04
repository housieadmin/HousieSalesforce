import { test, expect } from "../core";

const playerUrl = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/housie-account/a00g500001DFWqoAAH/housie-test-user-3";

test("create and clean up an isolated WAITING board", async ({ page, housie }) => {
  await page.goto(playerUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  const hub = page.locator("c-housie-board-hub");
  await expect(hub, "The test account route should render Board Hub").toHaveCount(1, { timeout: 60000 });
  await expect(hub.getByText("Your boards", { exact: true })).toBeVisible({ timeout: 60000 });

  const boardName = "Browser Setup " + new Date().toISOString().replace(/[:.]/g, "-");
  const card = page.locator("c-housie-board-hub article.board-card").filter({ hasText: boardName });

  await page.getByRole("textbox", { name: "Board name" }).fill(boardName);
  await page.getByRole("button", { name: "Create board", exact: true }).click();
  await expect(card, "Board creation should create a visible board membership").toBeVisible({ timeout: 60000 });
  await expect(card, "New boards must start with a WAITING game").toContainText("Game: WAITING");
  const cardText = await card.innerText();
  const boardId = cardText.match(/Board ID:\s*([a-f0-9]{32})/i)?.[1];
  expect(boardId, "Created board should expose its persistent board ID").toMatch(/^[a-f0-9]{32}$/i);
  housie.note("Created private WAITING board " + boardId + " for isolated setup verification.");
  await housie.screenshot("board-created-waiting");

  try {
    await card.getByRole("button", { name: "Leave board", exact: true }).click();
    await expect(card, "An empty board should be leaveable and removed from active memberships")
      .toHaveCount(0, { timeout: 60000 });
  } finally {
    // If the first leave attempt did not complete, make one bounded cleanup attempt.
    if (await card.count()) {
      await card.getByRole("button", { name: "Leave board", exact: true }).click().catch(() => {});
      await card.waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
    }
  }
});
