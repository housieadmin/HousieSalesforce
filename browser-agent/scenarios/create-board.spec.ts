import { test, expect } from "../core";

const playerUrl = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/housie-account/a00g500001DFWqoAAH/housie-test-user-3";

test("create and clean up an isolated WAITING board", async ({ page, housie }) => {
  const auraResults = [];
  page.on("response", response => {
    if (!/\/sfsites\/aura(?:\?|$)/.test(response.url()) || response.request().method() !== "POST") return;
    auraResults.push((async () => {
      const entry = { status: response.status(), errors: [] as string[] };
      try {
        const payload = JSON.parse(await response.text());
        const visit = value => {
          if (!value || typeof value !== "object") return;
          if (Array.isArray(value)) return value.forEach(visit);
          for (const key of ["message", "exceptionMessage", "errorCode", "state"]) {
            if (typeof value[key] === "string" && /error|exception|fail|invalid|denied|not enough|limit/i.test(value[key])) {
              entry.errors.push(key + ": " + value[key].slice(0, 1500));
            }
          }
          Object.values(value).forEach(visit);
        };
        visit(payload);
      } catch (error) {
        entry.errors.push("Unable to parse Aura response: " + String(error).slice(0, 300));
      }
      auraResults[auraResults.length] = entry;
    })());
  });

  await housie.navigate(playerUrl);
  const hub = page.locator("c-housie-board-hub");
  await expect(hub, "The test account route should render Board Hub").toHaveCount(1, { timeout: 60000 });
  await expect(hub.getByText("Your boards", { exact: true })).toBeVisible({ timeout: 60000 });

  const boardName = "Browser Setup " + Date.now();
  const card = page.locator("c-housie-board-hub article.board-card").filter({ hasText: boardName });
  await page.getByRole("textbox", { name: "Board name" }).fill(boardName);
  await page.getByRole("textbox", { name: "Board name" }).press("Tab");
  await page.getByRole("button", { name: "Create board", exact: true }).click();

  await expect.poll(async () => {
    const text = await hub.innerText();
    return /Board created|Unable to create board|not enough|error|failed/i.test(text) || await card.isVisible();
  }, { timeout: 60000 }).toBe(true);

  const afterClick = await hub.innerText();
  await Promise.all(auraResults);
  housie.note("Board Hub after create click:\n" + afterClick.slice(0, 6000));
  housie.note("Aura responses observed during board create: " + JSON.stringify(auraResults).slice(0, 6000));

  if (!await card.isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Refresh boards" }).click();
    await expect(card, "Board creation should create a visible board membership")
      .toBeVisible({ timeout: 30000 });
  }

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
