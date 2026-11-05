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
  await expect(app.getByText("Welcome, " + displayName, { exact: true })).toBeVisible({ timeout: 60000 });
  const hub = app.locator("c-housie-board-hub");
  await expect(hub).toHaveCount(1, { timeout: 30000 });
  await redactAccountKey(page);
  return hub;
}

async function purchaseOneTicket(hub: import("@playwright/test").Locator, boardName: string) {
  const card = hub.locator("article.board-card").filter({ hasText: boardName });
  await expect(card).toBeVisible({ timeout: 60000 });
  await card.getByRole("button", { name: "Buy ticket · 10 points", exact: true }).click();
  await expect(card.getByText("Active tickets: 1", { exact: true })).toBeVisible({ timeout: 60000 });
  const ticketText = await card.locator("article.ticket").innerText();
  const ticketId = ticketText.match(/([a-f0-9]{32})/i)?.[1];
  expect(ticketId).toMatch(/^[a-f0-9]{32}$/i);
  return ticketId as string;
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

  const ownerTicketId = await purchaseOneTicket(ownerHub, boardName);
  const memberTicketId = await purchaseOneTicket(memberHub, boardName);
  expect(ownerTicketId).not.toBe(memberTicketId);

  const games = sfQuery<Record<string, unknown>>(
    "SELECT Record_Id__c, Status__c, Operation_Id__c FROM Game__b WHERE Board_Id__c = '" + boardId + "' LIMIT 10"
  );
  const waitingGames = games.filter(row => row.Status__c === "WAITING");
  expect(waitingGames).toHaveLength(1);
  const gameId = String(waitingGames[0].Record_Id__c);

  const tickets = sfQuery<Record<string, unknown>>(
    "SELECT Record_Id__c, Owner_Account_Id__c, Status__c, Mode__c, Entry_Fee__c, Layout__c, Wallet_Hold_Id__c, Operation_Id__c FROM Ticket__b WHERE Game_Id__c = '" + gameId + "' AND Ticket_Kind__c = 'HUMAN' LIMIT 20"
  );
  const activeTickets = tickets.filter(row => row.Status__c === "ACTIVE");
  expect(activeTickets).toHaveLength(2);
  expect(new Set(activeTickets.map(row => row.Record_Id__c)).size).toBe(2);
  expect(new Set(activeTickets.map(row => row.Layout__c)).size).toBe(2);
  expect(activeTickets.map(row => row.Record_Id__c).sort()).toEqual([ownerTicketId, memberTicketId].sort());

  const accounts = [
    { displayName: owner.displayName, key: owner.key, ticketId: ownerTicketId },
    { displayName: member.displayName, key: member.key, ticketId: memberTicketId }
  ];
  for (const account of accounts) {
    const accountRows = sfQuery<Record<string, unknown>>(
      "SELECT Points_Balance__c, Reserved_Points__c FROM Housie_Account__c WHERE Account_Key__c = '" + account.key + "' LIMIT 2"
    );
    expect(accountRows).toHaveLength(1);
    expect(Number(accountRows[0].Points_Balance__c)).toBe(100);
    expect(Number(accountRows[0].Reserved_Points__c)).toBe(10);

    const owned = activeTickets.filter(row => row.Owner_Account_Id__c === account.key);
    expect(owned).toHaveLength(1);
    expect(Number(owned[0].Entry_Fee__c)).toBe(10);
    expect(owned[0].Mode__c).toBe("MANUAL");

    const holds = sfQuery<Record<string, unknown>>(
      "SELECT Hold_Id__c, Source_Id__c, Amount__c, Status__c, Operation_Id__c FROM Wallet_Hold__b WHERE Account_Id__c = '" + account.key + "' AND Game_Id__c = '" + gameId + "' LIMIT 10"
    );
    const accountHolds = holds.filter(row => row.Status__c === "ACTIVE" && row.Source_Id__c === account.ticketId);
    expect(accountHolds).toHaveLength(1);
    expect(Number(accountHolds[0].Amount__c)).toBe(10);
    expect(accountHolds[0].Hold_Id__c).toBe(owned[0].Wallet_Hold_Id__c);
    expect(accountHolds[0].Operation_Id__c).toBe(owned[0].Operation_Id__c);

    const transactions = sfQuery<Record<string, unknown>>(
      "SELECT Resource_Type__c, Transaction_Type__c, Quantity__c, Source_Type__c, Source_Id__c, Operation_Id__c FROM Account_Resource_Transaction__b WHERE Account_Id__c = '" + account.key + "' LIMIT 50"
    );
    const holdTransactions = transactions.filter(row =>
      row.Resource_Type__c === "POINTS" &&
      row.Transaction_Type__c === "HOLD_RESERVE" &&
      row.Source_Type__c === "HUMAN_TICKET" &&
      row.Source_Id__c === account.ticketId
    );
    expect(holdTransactions).toHaveLength(1);
    expect(Number(holdTransactions[0].Quantity__c)).toBe(10);
    expect(holdTransactions[0].Operation_Id__c).toBe(owned[0].Operation_Id__c);

    const journal = sfQuery<Record<string, unknown>>(
      "SELECT Status__c FROM Operation_Journal__b WHERE Operation_Id__c = '" + owned[0].Operation_Id__c + "' LIMIT 2"
    );
    expect(journal.some(row => row.Status__c === "COMMITTED")).toBe(true);

    const participants = sfQuery<Record<string, unknown>>(
      "SELECT Status__c FROM Game_Participant__b WHERE Game_Id__c = '" + gameId + "' AND Account_Id__c = '" + account.key + "' LIMIT 10"
    );
    expect(participants.some(row => row.Status__c === "ACTIVE")).toBe(true);
  }

  housie.note("Two distinct ACTIVE humans each own one unique ACTIVE ticket in the same WAITING game. Each account has a 10-point active hold, matching HOLD_RESERVE ledger row and COMMITTED operation journal; two active Game_Participant rows exist. Board ID=" + boardId + "; ticket IDs=" + ownerTicketId + "," + memberTicketId + ". Bearer keys and emails omitted.");
  await housie.screenshot("two-human-ticket-holds-verified-redacted");
  await memberPage.close();
});
