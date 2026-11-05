import { test, expect } from "../core";

const playerUrl = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/housie-account/a00g500001DFWqoAAH/housie-test-user-3";

test("create and clean up an isolated WAITING board", async ({ page, housie }) => {
  const auraTasks: Promise<{ status: number; errors: string[] }>[] = [];
  page.on("response", response => {
    if (!/\/sfsites\/aura(?:\?|$)/.test(response.url()) || response.request().method() !== "POST") return;
    auraTasks.push((async () => {
      const entry = { status: response.status(), errors: [] as string[] };
      try {
        const payload = JSON.parse(await response.text());
        const visit = value => {
          if (!value || typeof value !== "object") return;
          if (Array.isArray(value)) return value.forEach(visit);
          for (const key of ["message", "exceptionMessage", "errorCode", "state"]) {
            if (typeof value[key] === "string" && /error|exception|fail|invalid|denied|not enough|limit/i.test(value[key])) {
              entry.errors.push(key + ": " + value[key].slice(0, 1200));
            }
          }
          Object.values(value).forEach(visit);
        };
        visit(payload);
      } catch (error) {
        entry.errors.push("Unable to parse Aura response: " + String(error).slice(0, 250));
      }
      return entry;
    })());
  });

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
  let auraResponses = await Promise.all(auraTasks);
  if (!await card.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Refresh boards" }).click();
    await page.waitForTimeout(3000);
    afterClick = await hub.innerText();
    auraResponses = await Promise.all(auraTasks);
  }
  housie.note("Board Hub after create click:\n" + afterClick.slice(0, 6000));
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
