import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";
import { openLightningTab, redactAccountKey, queryBigObject } from "../utilities/salesforce";

function sfQuery<T extends Record<string, unknown>>(soql: string): T[] {
  let output: string;
  try {
    output = execFileSync("sf", [
      "data", "query", "--query", soql, "--target-org", "housie-browser-agent", "--json"
    ], { cwd: path.resolve(process.cwd(), ".."), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string | Buffer; stdout?: string | Buffer };
    const detail = [failure.stderr, failure.stdout, failure.message]
      .map(value => String(value ?? ""))
      .filter(Boolean)
      .join("\n")
      .replace(/\u001b\[[0-9;]*m/g, "")
      .replace(/[a-f0-9]{32}/gi, "[REDACTED_ID_OR_KEY]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
      .slice(0, 1600);
    throw new Error("Salesforce CLI query failed (exit " + String(failure.code ?? "unknown") + "). " + detail);
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

async function createAccount(page: import("@playwright/test").Page, stamp: number, suffix: string) {
  const email = "housie.m1.purchase." + stamp + "." + suffix + "@housie.test";
  const displayName = "M1 Purchase " + stamp + " " + suffix;
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Display name", exact: true }).fill(displayName);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  const line = page.getByText(/Account key:/);
  await expect(line).toBeVisible({ timeout: 60000 });
  const key = (await line.innerText()).match(/Account key:\s*([a-f0-9]{32})/i)?.[1];
  expect(key).toMatch(/^[a-f0-9]{32}$/i);
  await redactAccountKey(page);
  await expect(page.getByText(/^Status: /)).toHaveText("Status: ACTIVE", { timeout: 60000 });
  return { displayName, key: key as string };
}

async function openAccount(page: import("@playwright/test").Page, key: string, displayName: string) {
  const root = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/";
  await page.goto(root + "?token=" + encodeURIComponent(key), { waitUntil: "domcontentloaded" });
  const app = page.locator("c-housie-app");
  await expect(app).toHaveCount(1, { timeout: 60000 });
  await redactAccountKey(page);
  await expect(app.getByText("Welcome, " + displayName, { exact: true })).toBeVisible({ timeout: 60000 });
  const hub = app.locator("c-housie-board-hub");
  await expect(hub).toHaveCount(1, { timeout: 30000 });
  return hub;
}

function assertValidNinetyBallLayout(layoutText: string) {
  const rows = layoutText.split(/\r?\n/).map(line => line.trim().split(/\s+/));
  expect(rows, "A 90-ball ticket must have exactly three rows").toHaveLength(3);
  const parsed = rows.map(row => {
    expect(row, "A 90-ball ticket row must have nine cells").toHaveLength(9);
    return row.map(cell => cell === "·" ? null : Number(cell));
  });
  const numbers: number[] = [];
  for (let row = 0; row < 3; row++) {
    const values = parsed[row].filter((value): value is number => value !== null);
    expect(values, "Each ticket row must contain exactly five numbers").toHaveLength(5);
    numbers.push(...values);
    for (let column = 0; column < 9; column++) {
      const value = parsed[row][column];
      if (value === null) continue;
      const minimum = column === 0 ? 1 : column * 10;
      const maximum = column === 8 ? 90 : column * 10 + 9;
      expect(value, "Ticket number must belong to its 90-ball column").toBeGreaterThanOrEqual(minimum);
      expect(value).toBeLessThanOrEqual(maximum);
      if (row > 0 && parsed[row - 1][column] !== null) {
        expect(value, "Numbers must ascend down each column").toBeGreaterThan(parsed[row - 1][column] as number);
      }
    }
  }
  expect(numbers, "A 90-ball ticket must contain exactly 15 numbers").toHaveLength(15);
  expect(new Set(numbers).size, "A 90-ball ticket cannot contain duplicate numbers").toBe(15);
  for (let strip = 0; strip < 3; strip++) {
    const count = parsed.reduce((sum, row) =>
      sum + row.slice(strip * 3, strip * 3 + 3).filter(value => value !== null).length, 0);
    expect(count, "Each 3x3 strip must contain exactly five numbers").toBe(5);
  }
  for (const row of parsed) {
    for (let column = 0; column < 7; column++) {
      expect(row.slice(column, column + 3).every(value => value === null),
        "Three consecutive blank cells are not permitted horizontally").toBe(false);
    }
  }
  for (let column = 0; column < 9; column++) {
    expect(parsed.every(row => row[column] === null),
      "Three consecutive blank cells are not permitted vertically").toBe(false);
  }
}

async function purchaseOneTicket(hub: import("@playwright/test").Locator, boardName: string) {
  const card = hub.locator("article.board-card").filter({ hasText: boardName });
  await expect(card).toBeVisible({ timeout: 60000 });
  await card.getByRole("button", { name: /Buy ticket/ }).click();
  await expect(card.getByText("Active tickets: 1", { exact: true })).toBeVisible({ timeout: 60000 });
  const ticketText = await card.locator("article.ticket").innerText();
  const match = ticketText.match(/^(MANUAL|AUTOMATIC) · ([0-9.]+) points · ([a-f0-9]{32})\s+([\s\S]+)$/i);
  expect(match, "Ticket card should expose mode, fee, unique ticket ID and layout").not.toBeNull();
  return { ticketId: match![3], mode: match![1], entryFee: Number(match![2]), layoutText: match![4].trim() };
}

/**
 * Run only after the narrowly scoped HousieGameTicketService.cls fix is deployed.
 * The current Developer Org query is missing Mode__c/Entry_Fee__c/Layout__c in
 * completeTicketCommand(), which can leave a prepared command and active lock.
 */
test("two distinct humans purchase unique WAITING-game tickets with committed wallet holds", async ({ page, housie }) => {
  await openLightningTab(page, "/lightning/n/Housie_Account_Admin");
  await expect(page.getByText("Housie Account Administration", { exact: true })).toBeVisible({ timeout: 60000 });

  const stamp = Date.now();
  const owner = await createAccount(page, stamp, "owner");
  const member = await createAccount(page, stamp, "member");

  const ownerHub = await openAccount(page, owner.key, owner.displayName);
  await expect(ownerHub.getByText("No boards yet. Create your first board above.", { exact: true })).toBeVisible({ timeout: 60000 });
  const boardName = "M1 Ticket Purchase " + stamp;
  await ownerHub.getByRole("textbox", { name: "Board name", exact: true }).fill(boardName);
  await ownerHub.getByRole("button", { name: "Create board", exact: true }).click();
  const ownerCard = ownerHub.locator("article.board-card").filter({ hasText: boardName });
  await expect(ownerCard).toBeVisible({ timeout: 60000 });
  await expect(ownerCard).toContainText("Game: WAITING");
  const boardId = (await ownerCard.innerText()).match(/Board ID:\s*([a-f0-9]{32})/i)?.[1];
  expect(boardId).toMatch(/^[a-f0-9]{32}$/i);

  const memberPage = await page.context().newPage();
  const memberHub = await openAccount(memberPage, member.key, member.displayName);
  await expect(memberHub.getByText("No boards yet. Create your first board above.", { exact: true })).toBeVisible({ timeout: 60000 });
  await memberHub.getByRole("textbox", { name: "Invitation board ID", exact: true }).fill(boardId as string);
  await memberHub.getByRole("button", { name: "Join board", exact: true }).click();
  const memberCard = memberHub.locator("article.board-card").filter({ hasText: boardName });
  await expect(memberCard).toBeVisible({ timeout: 60000 });
  await expect(memberCard).toContainText("Game: WAITING");

  const ownerTicket = await purchaseOneTicket(ownerHub, boardName);
  const memberTicket = await purchaseOneTicket(memberHub, boardName);
  expect(ownerTicket.ticketId).not.toBe(memberTicket.ticketId);
  expect(ownerTicket.mode).toBe("MANUAL");
  expect(memberTicket.mode).toBe("MANUAL");
  expect(ownerTicket.entryFee).toBe(10);
  expect(memberTicket.entryFee).toBe(10);
  expect(ownerTicket.layoutText).not.toBe(memberTicket.layoutText);
  assertValidNinetyBallLayout(ownerTicket.layoutText);
  assertValidNinetyBallLayout(memberTicket.layoutText);

  // Reload both sessions so ticket visibility reflects committed storage.
  await page.reload({ waitUntil: "domcontentloaded" });
  const ownerApp = page.locator("c-housie-app");
  await expect(ownerApp).toHaveCount(1, { timeout: 60000 });
  await redactAccountKey(page);
  await expect(ownerApp.getByText("Welcome, " + owner.displayName, { exact: true })).toBeVisible({ timeout: 60000 });
  const ownerReloadedHub = ownerApp.locator("c-housie-board-hub");
  const ownerReloadedCard = ownerReloadedHub.locator("article.board-card").filter({ hasText: boardName });
  await expect(ownerReloadedCard.getByText("Active tickets: 1", { exact: true })).toBeVisible({ timeout: 60000 });
  await expect(ownerReloadedCard).toContainText("Game: WAITING");

  await memberPage.reload({ waitUntil: "domcontentloaded" });
  const memberApp = memberPage.locator("c-housie-app");
  await expect(memberApp).toHaveCount(1, { timeout: 60000 });
  await redactAccountKey(memberPage);
  await expect(memberApp.getByText("Welcome, " + member.displayName, { exact: true })).toBeVisible({ timeout: 60000 });
  const memberReloadedHub = memberApp.locator("c-housie-board-hub");
  const memberReloadedCard = memberReloadedHub.locator("article.board-card").filter({ hasText: boardName });
  await expect(memberReloadedCard.getByText("Active tickets: 1", { exact: true })).toBeVisible({ timeout: 60000 });
  await expect(memberReloadedCard).toContainText("Game: WAITING");

  const games = queryBigObject<Record<string, unknown>>(
    "SELECT Board_Id__c, Status__c, Record_Id__c FROM Game__b WHERE Board_Id__c = '" + boardId + "'"
  );
  expect(games).toHaveLength(1);
  expect(games[0].Status__c).toBe("WAITING");
  const gameId = String(games[0].Record_Id__c);

  const tickets = queryBigObject<Record<string, unknown>>(
    "SELECT Game_Id__c, Ticket_Kind__c, Record_Id__c FROM Ticket__b WHERE Game_Id__c = '" + gameId + "' AND Ticket_Kind__c = 'HUMAN'"
  );
  const ticketIds = tickets.map(row => String(row.Record_Id__c));
  expect(tickets).toHaveLength(2);
  expect(new Set(ticketIds).size).toBe(2);
  expect(ticketIds.sort()).toEqual([ownerTicket.ticketId, memberTicket.ticketId].sort());

  const accounts = [
    { key: owner.key, ticket: ownerTicket },
    { key: member.key, ticket: memberTicket }
  ];
  for (const account of accounts) {
    const accountRows = sfQuery<Record<string, unknown>>(
      "SELECT Points_Balance__c, Reserved_Points__c FROM Housie_Account__c WHERE Account_Key__c = '" + account.key + "'"
    );
    expect(accountRows).toHaveLength(1);
    expect(Number(accountRows[0].Points_Balance__c)).toBe(100);
    expect(Number(accountRows[0].Reserved_Points__c)).toBe(10);

    const holds = queryBigObject<Record<string, unknown>>(
      "SELECT Account_Id__c, Game_Id__c, Hold_Id__c FROM Wallet_Hold__b WHERE Account_Id__c = '" + account.key + "' AND Game_Id__c = '" + gameId + "'"
    );
    expect(holds).toHaveLength(1);

    const transactions = queryBigObject<Record<string, unknown>>(
      "SELECT Account_Id__c, Created_At__c, Record_Id__c FROM Account_Resource_Transaction__b WHERE Account_Id__c = '" + account.key + "'"
    );
    expect(transactions).toHaveLength(5);

    const participants = queryBigObject<Record<string, unknown>>(
      "SELECT Game_Id__c, Account_Id__c, Record_Id__c FROM Game_Participant__b WHERE Game_Id__c = '" + gameId + "' AND Account_Id__c = '" + account.key + "'"
    );
    expect(participants).toHaveLength(1);
  }

  housie.note("Two distinct ACTIVE humans each own one unique MANUAL ticket in the same WAITING game. Each account has a persisted wallet-hold row, 10 reserved points, five resource transaction rows (four signup grants plus one ticket hold), and one Game_Participant row. Both tickets and memberships remain visible after reload. Board ID=" + boardId + "; ticket IDs=" + ownerTicket.ticketId + "," + memberTicket.ticketId + ". Bearer keys and emails omitted.");
  await housie.screenshot("two-human-ticket-holds-verified-redacted");

  // Exercise the full WAITING withdrawal lifecycle for both humans, then
  // repurchase one ticket to prove the released hold is reusable.
  const ownerLedgerBeforeWithdrawal = queryBigObject<Record<string, unknown>>(
    "SELECT Account_Id__c, Created_At__c, Record_Id__c FROM Account_Resource_Transaction__b WHERE Account_Id__c = '" + owner.key + "'"
  );
  const memberLedgerBeforeWithdrawal = queryBigObject<Record<string, unknown>>(
    "SELECT Account_Id__c, Created_At__c, Record_Id__c FROM Account_Resource_Transaction__b WHERE Account_Id__c = '" + member.key + "'"
  );

  await ownerReloadedCard.getByRole("button", { name: "Withdraw from waiting game", exact: true }).click();
  await expect(ownerReloadedCard.getByText("Active tickets: 0", { exact: true })).toBeVisible({ timeout: 60000 });
  await expect(ownerReloadedCard.getByRole("button", { name: /Buy ticket/ })).toBeVisible();
  await memberReloadedCard.getByRole("button", { name: "Withdraw from waiting game", exact: true }).click();
  await expect(memberReloadedCard.getByText("Active tickets: 0", { exact: true })).toBeVisible({ timeout: 60000 });
  await expect(memberReloadedCard.getByRole("button", { name: /Buy ticket/ })).toBeVisible();

  for (const account of [owner, member]) {
    const rows = sfQuery<Record<string, unknown>>(
      "SELECT Points_Balance__c, Reserved_Points__c FROM Housie_Account__c WHERE Account_Key__c = '" + account.key + "'"
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].Points_Balance__c)).toBe(100);
    expect(Number(rows[0].Reserved_Points__c)).toBe(0);
    const releasedHolds = queryBigObject<Record<string, unknown>>(
      "SELECT Account_Id__c, Game_Id__c, Hold_Id__c FROM Wallet_Hold__b WHERE Account_Id__c = '" + account.key + "' AND Game_Id__c = '" + gameId + "'"
    );
    expect(releasedHolds, "Withdrawal must release the account's active wallet hold").toHaveLength(0);
  }
  const ownerLedgerAfterWithdrawal = queryBigObject<Record<string, unknown>>(
    "SELECT Account_Id__c, Created_At__c, Record_Id__c FROM Account_Resource_Transaction__b WHERE Account_Id__c = '" + owner.key + "'"
  );
  const memberLedgerAfterWithdrawal = queryBigObject<Record<string, unknown>>(
    "SELECT Account_Id__c, Created_At__c, Record_Id__c FROM Account_Resource_Transaction__b WHERE Account_Id__c = '" + member.key + "'"
  );
  expect(ownerLedgerAfterWithdrawal).toHaveLength(ownerLedgerBeforeWithdrawal.length + 1);
  expect(memberLedgerAfterWithdrawal).toHaveLength(memberLedgerBeforeWithdrawal.length + 1);

  await ownerReloadedCard.getByRole("button", { name: /Buy ticket/ }).click();
  await expect(ownerReloadedCard.getByText("Active tickets: 1", { exact: true })).toBeVisible({ timeout: 60000 });
  const replacementTicketText = await ownerReloadedCard.locator("article.ticket").innerText();
  const replacementTicketId = replacementTicketText.match(/(?:MANUAL|AUTOMATIC) · [0-9.]+ points · ([a-f0-9]{32})/i)?.[1];
  expect(replacementTicketId, "Repurchase after withdrawal should create a fresh ticket ID").toMatch(/^[a-f0-9]{32}$/i);
  expect(replacementTicketId).not.toBe(ownerTicket.ticketId);
  const ownerAfterRepurchase = sfQuery<Record<string, unknown>>(
    "SELECT Points_Balance__c, Reserved_Points__c FROM Housie_Account__c WHERE Account_Key__c = '" + owner.key + "'"
  );
  expect(ownerAfterRepurchase).toHaveLength(1);
  expect(Number(ownerAfterRepurchase[0].Points_Balance__c)).toBe(100);
  expect(Number(ownerAfterRepurchase[0].Reserved_Points__c)).toBe(10);
  const replacementHolds = queryBigObject<Record<string, unknown>>(
    "SELECT Account_Id__c, Game_Id__c, Hold_Id__c FROM Wallet_Hold__b WHERE Account_Id__c = '" + owner.key + "' AND Game_Id__c = '" + gameId + "'"
  );
  expect(replacementHolds, "Repurchase must create a fresh active wallet hold").toHaveLength(1);
  const ownerLedgerAfterRepurchase = queryBigObject<Record<string, unknown>>(
    "SELECT Account_Id__c, Created_At__c, Record_Id__c FROM Account_Resource_Transaction__b WHERE Account_Id__c = '" + owner.key + "'"
  );
  expect(ownerLedgerAfterRepurchase).toHaveLength(ownerLedgerAfterWithdrawal.length + 1);

  housie.note("WAITING withdrawal released both humans' 10-point holds with one ledger release row each. Owner then repurchased a fresh ticket; reserved points returned to 10 and one new hold-reserve ledger row was recorded. Ticket ID and account keys are not included in retained notes.");
  await housie.screenshot("two-human-withdrawal-and-repurchase-redacted");
  await memberPage.close();
});
