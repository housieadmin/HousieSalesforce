import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";
import { openLightningTab, redactAccountKey } from "../utilities/salesforce";

function sfQuery<T extends Record<string, unknown>>(soql: string): T[] {
  let output: string;
  try {
    output = execFileSync("sf", [
      "data", "query", "--query", soql, "--target-org", "housie-browser-agent", "--json"
    ], { cwd: path.resolve(process.cwd(), ".."), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    throw new Error("Salesforce CLI query failed; query text and credentials were not copied into diagnostics.");
  }
  const clean = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
  const start = clean.indexOf("{");
  if (start < 0) throw new Error("Salesforce CLI did not return JSON.");
  const parsed = JSON.parse(clean.slice(start));
  if (parsed.status !== 0) throw new Error("Salesforce CLI returned a non-zero query status.");
  if (Array.isArray(parsed.result?.records)) return parsed.result.records as T[];
  if (Array.isArray(parsed.result)) return parsed.result as T[];
  throw new Error("Salesforce CLI query response did not contain records.");
}

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

  const ownerMembership = sfQuery<Record<string, unknown>>(
    "SELECT Board_Role__c, Status__c, Operation_Id__c FROM Board_Member__b WHERE Account_Id__c = '" + owner.key + "' AND Board_Id__c = '" + boardId + "' LIMIT 10"
  );
  expect(ownerMembership.filter(x => x.Status__c === "ACTIVE" && x.Board_Role__c === "BOARD_ADMIN")).toHaveLength(1);
  const ownerJournal = sfQuery<Record<string, unknown>>(
    "SELECT Status__c FROM Operation_Journal__b WHERE Operation_Id__c = '" + ownerMembership[0].Operation_Id__c + "' LIMIT 2"
  );
  expect(ownerJournal.some(x => x.Status__c === "COMMITTED")).toBe(true);

  const memberHub = await openPublicAccount(page, member.key, member.displayName);
  await expect(memberHub.getByText("No boards yet. Create your first board above.", { exact: true }))
    .toBeVisible({ timeout: 60000 });
  await memberHub.getByRole("textbox", { name: "Invitation board ID", exact: true }).fill(boardId as string);
  await memberHub.getByRole("button", { name: "Join board", exact: true }).click();
  const memberCard = memberHub.locator("article.board-card").filter({ hasText: boardName });
  await expect(memberCard, "Second distinct human should join the same board").toBeVisible({ timeout: 60000 });
  await expect(memberCard).toContainText("Game: WAITING");

  const memberMembership = sfQuery<Record<string, unknown>>(
    "SELECT Board_Role__c, Status__c, Operation_Id__c FROM Board_Member__b WHERE Account_Id__c = '" + member.key + "' AND Board_Id__c = '" + boardId + "' LIMIT 10"
  );
  expect(memberMembership.filter(x => x.Status__c === "ACTIVE" && x.Board_Role__c === "MEMBER")).toHaveLength(1);
  const memberJournal = sfQuery<Record<string, unknown>>(
    "SELECT Status__c FROM Operation_Journal__b WHERE Operation_Id__c = '" + memberMembership[0].Operation_Id__c + "' LIMIT 2"
  );
  expect(memberJournal.some(x => x.Status__c === "COMMITTED")).toBe(true);

  const games = sfQuery<Record<string, unknown>>(
    "SELECT Record_Id__c, Status__c, Operation_Id__c FROM Game__b WHERE Board_Id__c = '" + boardId + "' LIMIT 10"
  );
  const waitingGames = games.filter(x => x.Status__c === "WAITING");
  expect(waitingGames).toHaveLength(1);
  const gameJournal = sfQuery<Record<string, unknown>>(
    "SELECT Status__c FROM Operation_Journal__b WHERE Operation_Id__c = '" + waitingGames[0].Operation_Id__c + "' LIMIT 2"
  );
  expect(gameJournal.some(x => x.Status__c === "COMMITTED")).toBe(true);

  await redactAccountKey(page);
  housie.note("Two-human WAITING board setup passed: owner and member are distinct ACTIVE accounts; Board_Member records and operation journals are COMMITTED; one WAITING game persists. Board ID=" + boardId + "; fixture display names=" + owner.displayName + " / " + member.displayName + ". Bearer keys and synthetic emails omitted.");
  await housie.screenshot("two-human-waiting-board-member-redacted");
});
