import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";
import { openLightningTab, redactAccountKey, queryBigObject } from "../utilities/salesforce";

test.use({ trace: "off" });

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
    throw new Error("Salesforce CLI query failed. " + detail);
  }
  const clean = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
  const start = clean.indexOf("{");
  if (start < 0) throw new Error("Salesforce CLI did not return JSON.");
  const parsed = JSON.parse(clean.slice(start));
  if (parsed.status !== 0 || !Array.isArray(parsed.result?.records)) {
    throw new Error("Salesforce CLI query failed or returned no records.");
  }
  return parsed.result.records as T[];
}

function safeBigQuery<T extends Record<string, unknown>>(soql: string): T[] {
  try {
    return queryBigObject<T>(soql);
  } catch (error) {
    const detail = String(error)
      .replace(/[a-f0-9]{32}/gi, "[REDACTED_ID_OR_KEY]")
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
      .slice(0, 1200);
    throw new Error("Big Object query failed. " + detail);
  }
}

async function createAccount(page: import("@playwright/test").Page, stamp: number, suffix: string) {
  const email = "housie.m1.start." + stamp + "." + suffix + "@housie.test";
  const displayName = "M1 Start " + stamp + " " + suffix;
  await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Display name", exact: true }).fill(displayName);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  const keyLine = page.getByText(/Account key:/);
  await expect(keyLine).toBeVisible({ timeout: 60000 });
  const key = (await keyLine.innerText()).match(/Account key:\s*([a-f0-9]{32})/i)?.[1];
  expect(/^[a-f0-9]{32}$/i.test(key || "")).toBe(true);
  await redactAccountKey(page);
  await expect(page.getByText("Status: ACTIVE", { exact: true })).toBeVisible({ timeout: 60000 });
  return { key: key as string, displayName };
}

async function openAccount(
  page: import("@playwright/test").Page,
  key: string,
  displayName: string,
  housie: { note(message: string): void }
) {
  await page.addInitScript(() => {
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    (window as any).__housieRouteTransport = {
      queryTokenPresent: query.has("c__token") || query.has("token"),
      fragmentTokenPresent: fragment.has("c__token") || fragment.has("token"),
      historyTokenPresent: Boolean((window.history.state as any)?.housieAccountToken)
    };
  });
  const root = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/";
  await page.goto(root + "?c__token=" + encodeURIComponent(key) +
    "&token=" + encodeURIComponent(key) + "#c__token=" + encodeURIComponent(key),
    { waitUntil: "domcontentloaded" });
  const routeTransport = await page.evaluate(() => (window as any).__housieRouteTransport || {});
  housie.note("Public route transport flags: " + JSON.stringify(routeTransport));
  const app = page.locator("c-housie-app");
  await expect(app).toHaveCount(1, { timeout: 60000 });
  await redactAccountKey(page, false);
  const cleanRoute = await page.evaluate(() => {
    const query = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    return {
      queryTokenPresent: query.has("c__token") || query.has("token"),
      fragmentTokenPresent: fragment.has("c__token") || fragment.has("token"),
      historyTokenPresent: Boolean((window.history.state as any)?.housieAccountToken)
    };
  });
  expect(cleanRoute.queryTokenPresent).toBe(false);
  expect(cleanRoute.fragmentTokenPresent).toBe(false);
  await expect(app.getByText("Welcome, " + displayName, { exact: true }))
    .toBeVisible({ timeout: 60000 });
  const hub = app.locator("c-housie-board-hub");
  await expect(hub).toHaveCount(1, { timeout: 30000 });
  return { app, hub };
}

async function buyTicket(hub: import("@playwright/test").Locator, boardName: string) {
  const card = hub.locator("article.board-card").filter({ hasText: boardName });
  await expect(card).toBeVisible({ timeout: 60000 });
  await card.getByRole("button", { name: /Buy ticket/ }).click();
  await expect(card.getByText("Active tickets: 1", { exact: true })).toBeVisible({ timeout: 60000 });
  const ticket = await card.locator("article.ticket").innerText();
  const match = ticket.match(/^(MANUAL|AUTOMATIC) · ([0-9.]+) points · ([a-f0-9]{32})/i);
  expect(match).not.toBeNull();
  return { ticketId: match![3], mode: match![1], fee: Number(match![2]) };
}

test("two-human start requires the second role and captures both ticket holds before RUNNING", async ({ page, housie }) => {
  test.setTimeout(360000);
  await openLightningTab(page, "/lightning/n/Housie_Account_Admin");
  await expect(page.getByText("Housie Account Administration", { exact: true })).toBeVisible({ timeout: 60000 });

  const stamp = Date.now();
  const owner = await createAccount(page, stamp, "owner");
  const member = await createAccount(page, stamp, "member");
  const ownerSession = await openAccount(page, owner.key, owner.displayName, housie);
  const boardName = "M1 Start Board " + stamp;

  await ownerSession.hub.getByRole("textbox", { name: "Board name", exact: true }).fill(boardName);
  await ownerSession.hub.getByRole("button", { name: "Create board", exact: true }).click();
  const ownerCard = ownerSession.hub.locator("article.board-card").filter({ hasText: boardName });
  await expect(ownerCard).toContainText("Game: WAITING", { timeout: 60000 });
  const boardId = (await ownerCard.innerText()).match(/Board ID:\s*([a-f0-9]{32})/i)?.[1];
  expect(/^[a-f0-9]{32}$/i.test(boardId || "")).toBe(true);

  const memberPage = await page.context().newPage();
  const memberSession = await openAccount(memberPage, member.key, member.displayName, housie);
  await memberSession.hub.getByRole("textbox", { name: "Invitation board ID", exact: true }).fill(boardId as string);
  await memberSession.hub.getByRole("button", { name: "Join board", exact: true }).click();
  const memberCard = memberSession.hub.locator("article.board-card").filter({ hasText: boardName });
  await expect(memberCard).toContainText("Game: WAITING", { timeout: 60000 });

  const ownerTicket = await buyTicket(ownerSession.hub, boardName);
  const memberTicket = await buyTicket(memberSession.hub, boardName);
  expect(ownerTicket.ticketId).not.toBe(memberTicket.ticketId);
  expect(ownerTicket.mode).toBe("MANUAL");
  expect(memberTicket.mode).toBe("MANUAL");
  expect(ownerTicket.fee).toBe(10);
  expect(memberTicket.fee).toBe(10);

  const initialGames = safeBigQuery<Record<string, unknown>>(
    "SELECT Board_Id__c, Status__c, Record_Id__c FROM Game__b WHERE Board_Id__c = '" + boardId + "'"
  );
  expect(initialGames).toHaveLength(1);
  const gameId = String(initialGames[0].Record_Id__c);

  // The game admin is the first eligible participant; both active tabs heartbeat.
  await ownerSession.hub.getByRole("button", { name: "Refresh boards" }).click();
  await expect(ownerCard.getByRole("button", { name: "Request game start", exact: true }))
    .toBeVisible({ timeout: 60000 });
  await ownerCard.getByRole("button", { name: "Request game start", exact: true }).click();

  await memberSession.hub.getByRole("button", { name: "Refresh boards" }).click();
  const approvalCard = memberSession.hub.locator("article.board-card").filter({ hasText: boardName });
  await expect(approvalCard.getByRole("button", { name: "Approve", exact: true }))
    .toBeVisible({ timeout: 60000 });
  await approvalCard.getByRole("button", { name: "Approve", exact: true }).click();

  await expect(approvalCard).toContainText("Game: RUNNING", { timeout: 120000 });
  await ownerSession.hub.getByRole("button", { name: "Refresh boards" }).click();
  await expect(ownerCard).toContainText("Game: RUNNING", { timeout: 60000 });

  const runningGames = safeBigQuery<Record<string, unknown>>(
    "SELECT Board_Id__c, Status__c, Record_Id__c, Current_Admin_Account_Id__c, Wallet_Total__c, Wallet_Obligations__c, Wallet_Available__c, Started_At__c, Event_Sequence__c FROM Game__b WHERE Board_Id__c = '" + boardId + "' AND Status__c = 'RUNNING'"
  );
  expect(runningGames).toHaveLength(1);
  const game = runningGames[0];
  expect(String(game.Record_Id__c)).toBe(gameId);
  expect(game.Current_Admin_Account_Id__c === owner.key).toBe(true);
  expect(Number(game.Wallet_Total__c)).toBe(20);
  expect(Number(game.Wallet_Obligations__c)).toBe(0);
  expect(Number(game.Wallet_Available__c)).toBe(20);
  expect(game.Started_At__c).toBeTruthy();
  expect(Number(game.Event_Sequence__c)).toBe(2);

  const actionRequests = safeBigQuery<Record<string, unknown>>(
    "SELECT Game_Id__c, Status__c, Record_Id__c, Requester_Account_Id__c, Executed_At__c FROM Game_Action_Request__b WHERE Game_Id__c = '" + gameId + "'"
  );
  const approvedRequest = actionRequests.find(row => row.Status__c === "APPROVED" &&
    row.Requester_Account_Id__c === owner.key && row.Executed_At__c);
  expect(approvedRequest, "Owner's start request should be approved and executed").toBeTruthy();
  const requestId = String(approvedRequest!.Record_Id__c);
  const approvals = safeBigQuery<Record<string, unknown>>(
    "SELECT Request_Id__c, Account_Id__c, Response__c, Eligibility_Role__c FROM Game_Action_Response__b WHERE Request_Id__c = '" + requestId + "'"
  );
  expect(approvals).toHaveLength(1);
  expect(approvals[0].Account_Id__c === member.key).toBe(true);
  expect(approvals[0].Response__c).toBe("APPROVE");
  expect(approvals[0].Eligibility_Role__c).toBe("NON_ADMIN");

  const ledger = safeBigQuery<Record<string, unknown>>(
    "SELECT Game_Id__c, Entry_Type__c, Amount__c, Ticket_Id__c FROM Game_Ledger__b WHERE Game_Id__c = '" + gameId + "' AND Entry_Type__c = 'TICKET_CAPTURED'"
  );
  expect(ledger).toHaveLength(2);
  expect(ledger.map(row => Number(row.Amount__c)).reduce((sum, amount) => sum + amount, 0)).toBe(20);
  expect(new Set(ledger.map(row => String(row.Ticket_Id__c)))).toEqual(
    new Set([ownerTicket.ticketId, memberTicket.ticketId])
  );

  for (const account of [owner, member]) {
    const accountRows = sfQuery<Record<string, unknown>>(
      "SELECT Points_Balance__c, Reserved_Points__c FROM Housie_Account__c WHERE Account_Key__c = '" + account.key + "'"
    );
    expect(accountRows).toHaveLength(1);
    expect(Number(accountRows[0].Points_Balance__c)).toBe(90);
    expect(Number(accountRows[0].Reserved_Points__c)).toBe(0);

    const holds = safeBigQuery<Record<string, unknown>>(
      "SELECT Account_Id__c, Game_Id__c, Hold_Id__c, Status__c, Amount__c FROM Wallet_Hold__b WHERE Account_Id__c = '" + account.key + "' AND Game_Id__c = '" + gameId + "'"
    );
    expect(holds).toHaveLength(2);
    expect(holds.some(row => row.Status__c === "ACTIVE")).toBe(true);
    expect(holds.some(row => row.Status__c === "CAPTURED" && Number(row.Amount__c) === 10)).toBe(true);

    const transactions = safeBigQuery<Record<string, unknown>>(
      "SELECT Account_Id__c, Transaction_Type__c, Quantity__c FROM Account_Resource_Transaction__b WHERE Account_Id__c = '" + account.key + "'"
    );
    expect(transactions.filter(row => row.Transaction_Type__c === "HOLD_CAPTURE" &&
      Number(row.Quantity__c) === -10)).toHaveLength(1);
  }

  const startCommands = sfQuery<Record<string, unknown>>(
    "SELECT Account_Key__c, Action_Type__c, Status__c FROM Housie_Ticket_Command__c WHERE Account_Key__c IN ('" + owner.key + "','" + member.key + "')"
  );
  expect(startCommands.some(row => row.Action_Type__c === "START_REQUEST" && row.Status__c === "COMMITTED")).toBe(true);
  expect(startCommands.some(row => row.Action_Type__c === "START_EXECUTION" && row.Status__c === "COMMITTED")).toBe(true);

  housie.note("Two-human Package 1 acceptance passed: the first participant requested start, the second participant supplied the non-admin approval, both ticket holds were captured, both account balances moved from 100/10 reserved to 90/0 reserved, Game Wallet totals 20, and the game reached RUNNING. No bearer keys, emails, board IDs, game IDs or ticket IDs are retained.");
  await memberPage.close();
});
