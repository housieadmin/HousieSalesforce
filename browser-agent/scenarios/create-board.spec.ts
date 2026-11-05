import { test, expect } from "../core";
import { captureAuraErrors } from "../utilities/salesforce";

const playerUrl = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/housie-account/a00g500001DFWqoAAH/housie-test-user-3";

test("create and clean up an isolated WAITING board", async ({ page, housie }) => {
  const auraDiagnostics = captureAuraErrors(page);

  await housie.navigate(playerUrl);
  const hub = page.locator("c-housie-board-hub");
  await expect(hub, "The test account route should render Board Hub").toHaveCount(1, { timeout: 60000 });
  await expect(hub.getByText("Your boards", { exact: true })).toBeVisible({ timeout: 60000 });

  const boardName = "Browser Setup " + Date.now();
  const card = page.locator("c-housie-board-hub article.board-card").filter({ hasText: boardName });
  const nameInput = page.getByRole("textbox", { name: "Board name" });
  await nameInput.fill(boardName);
  await nameInput.press("Tab");
  await page.getByRole("button", { name: "Create board", exact: true }).click();

  await page.waitForTimeout(6000);
  let afterClick = await hub.innerText();
  let auraResponses = await auraDiagnostics.snapshot();
  if (!await card.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Refresh boards" }).click();
    await page.waitForTimeout(3000);
    afterClick = await hub.innerText();
    auraResponses = await auraDiagnostics.snapshot();
  }
  housie.note("Board Hub after create click:\n" + afterClick.slice(0, 6000));
  auraDiagnostics.stop();
  housie.note("Aura responses observed during board create: " + JSON.stringify(auraResponses).slice(0, 4000));

  await expect(card, "Board creation should create a visible board membership").toBeVisible({ timeout: 15000 });
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
    if (await card.count()) {
      await card.getByRole("button", { name: "Leave board", exact: true }).click().catch(() => {});
      await card.waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
    }
  }
});
