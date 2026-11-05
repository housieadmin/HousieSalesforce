import { test, expect } from "../core";
import { openLightningTab, redactAccountKey, queryBigObject } from "../utilities/salesforce";

async function createActiveAccount(page: import("@playwright/test").Page, stamp: number, suffix: string) {
  const email = "housie.m1.twohuman." + stamp + "." + suffix + "@housie.test";
  const displayName = "M1 Two Human " + stamp + " " + suffix;
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Display name", exact: true }).fill(displayName);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  const keyLine = page.getByText(/Account key:/);
  await expect(keyLine).toBeVisible({ timeout: 60000 });
  const keyText = await keyLine.innerText();
  const key = keyText.match(/Account key:\s*([a-f0-9]{32})/i)?.[1];
  expect(key, "Account Admin should issue a 32-character bearer key").toMatch(/^[a-f0-9]{32}$/i);
  await redactAccountKey(page);
  await expect(page.getByText(/^Status: /)).toHaveText("Status: ACTIVE", { timeout: 60000 });
  return { email, displayName, key: key as string };
}

async function openPublicAccount(page: import("@playwright/test").Page, key: string, displayName: string) {
  const root = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/";
  await page.goto(root + "?token=" + encodeURIComponent(key), { waitUntil: "domcontentloaded" });
  const app = page.locator("c-housie-app");
  await expect(app).toHaveCount(1, { timeout: 60000 });
  // Account_Key__c is a bearer credential rendered by HousieApp; redact it
  // immediately after context resolution and before further assertions.
  await redactAccountKey(page);
  await expect(app.getByText("Welcome, " + displayName, { exact: true })).toBeVisible({ timeout: 60000 });
  const hub = app.locator("c-housie-board-hub");
  await expect(hub).toHaveCount(1, { timeout: 30000 });
  return hub;
}

test("two distinct active humans create and join the same WAITING board", async ({ page, housie }) => {
  await openLightningTab(page, "/lightning/n/Housie_Account_Admin");
  await expect(page.getByText("Housie Account Administration", { exact: true }))
    .toBeVisible({ timeout: 60000 });

  const stamp = Date.now();
  const owner = await createActiveAccount(page, stamp, "owner");
  const member = await createActiveAccount(page, stamp, "member");

  const ownerHub = await openPublicAccount(page, owner.key, owner.displayName);
  await expect(ownerHub.getByText("No boards yet. Create your first board above.", { exact: true }))
    .toBeVisible({ timeout: 60000 });

  const boardName = "M1 Two Human " + stamp;
  await ownerHub.getByRole("textbox", { name: "Board name", exact: true }).fill(boardName);
  await ownerHub.getByRole("button", { name: "Create board", exact: true }).click();
  const ownerCard = ownerHub.locator("article.board-card").filter({ hasText: boardName });
  await expect(ownerCard, "Owner should receive a persisted board membership").toBeVisible({ timeout: 60000 });
  await expect(ownerCard).toContainText("Game: WAITING");
  const boardId = (await ownerCard.innerText()).match(/Board ID:\s*([a-f0-9]{32})/i)?.[1];
  expect(boardId).toMatch(/^[a-f0-9]{32}$/i);

  const memberPage = await page.context().newPage();
  const memberHub = await openPublicAccount(memberPage, member.key, member.displayName);
  await expect(memberHub.getByText("No boards yet. Create your first board above.", { exact: true }))
    .toBeVisible({ timeout: 60000 });
  await memberHub.getByRole("textbox", { name: "Invitation board ID", exact: true }).fill(boardId as string);
  await memberHub.getByRole("button", { name: "Join board", exact: true }).click();
  const memberCard = memberHub.locator("article.board-card").filter({ hasText: boardName });
  await expect(memberCard, "Second distinct human should join the same board").toBeVisible({ timeout: 60000 });
  await expect(memberCard).toContainText("Game: WAITING");

  // Reload both token sessions so membership is proven from persisted
  // Board_Member/Game rows, not only the optimistic create/join response.
  await page.reload({ waitUntil: "domcontentloaded" });
  const ownerApp = page.locator("c-housie-app");
  await expect(ownerApp).toHaveCount(1, { timeout: 60000 });
  await redactAccountKey(page);
  await expect(ownerApp.getByText("Welcome, " + owner.displayName, { exact: true })).toBeVisible({ timeout: 60000 });
  await expect(ownerApp.locator("c-housie-board-hub").locator("article.board-card").filter({ hasText: boardName }))
    .toContainText("Game: WAITING", { timeout: 60000 });

  await memberPage.reload({ waitUntil: "domcontentloaded" });
  const memberApp = memberPage.locator("c-housie-app");
  await expect(memberApp).toHaveCount(1, { timeout: 60000 });
  await redactAccountKey(memberPage);
  await expect(memberApp.getByText("Welcome, " + member.displayName, { exact: true })).toBeVisible({ timeout: 60000 });
  await expect(memberApp.locator("c-housie-board-hub").locator("article.board-card").filter({ hasText: boardName }))
    .toContainText("Game: WAITING", { timeout: 60000 });

  const ownerMembership = queryBigObject<Record<string, unknown>>(
    "SELECT Account_Id__c, Board_Id__c, Record_Id__c FROM Board_Member__b WHERE Account_Id__c = '" + owner.key + "' AND Board_Id__c = '" + boardId + "'"
  );
  expect(ownerMembership).toHaveLength(1);
  expect(ownerMembership[0].Account_Id__c).toBe(owner.key);
  expect(ownerMembership[0].Board_Id__c).toBe(boardId);

  const memberMembership = queryBigObject<Record<string, unknown>>(
    "SELECT Account_Id__c, Board_Id__c, Record_Id__c FROM Board_Member__b WHERE Account_Id__c = '" + member.key + "' AND Board_Id__c = '" + boardId + "'"
  );
  expect(memberMembership).toHaveLength(1);
  expect(memberMembership[0].Account_Id__c).toBe(member.key);
  expect(memberMembership[0].Board_Id__c).toBe(boardId);

  const games = queryBigObject<Record<string, unknown>>(
    "SELECT Board_Id__c, Status__c, Record_Id__c FROM Game__b WHERE Board_Id__c = '" + boardId + "'"
  );
  expect(games).toHaveLength(1);
  expect(games[0].Status__c).toBe("WAITING");

  housie.note("Two-human WAITING board setup passed: owner and member are distinct ACTIVE accounts; both Board_Member index rows and one Game row persist; BoardHub lists the WAITING board for both accounts after independent reloads. Board ID=" + boardId + "; fixture display names=" + owner.displayName + " / " + member.displayName + ". Bearer keys and synthetic emails omitted.");
  await housie.screenshot("two-human-waiting-board-member-redacted");
  await memberPage.close();
});
