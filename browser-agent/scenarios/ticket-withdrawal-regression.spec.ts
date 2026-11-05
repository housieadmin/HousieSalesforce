import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";
import { queryBigObject } from "../utilities/salesforce";

test.use({ trace: "off" });

function sfQuery<T extends Record<string, unknown>>(soql: string): T[] {
  try {
    const output = execFileSync("sf", [
      "data", "query", "--query", soql, "--target-org", "housie-browser-agent", "--json"
    ], { cwd: path.resolve(process.cwd(), ".."), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    const clean = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
    const start = clean.indexOf("{");
    if (start < 0) throw new Error("Salesforce CLI did not return JSON.");
    const parsed = JSON.parse(clean.slice(start));
    if (parsed.status !== 0) throw new Error("Salesforce CLI query failed.");
    return Array.isArray(parsed.result?.records) ? parsed.result.records as T[] : [];
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string | Buffer; stdout?: string | Buffer };
    const detail = [failure.stderr, failure.stdout, failure.message]
      .map(value => String(value ?? ""))
      .filter(Boolean)
      .join("\n")
      .replace(/\u001b\[[0-9;]*m/g, "")
      .replace(/[a-f0-9]{32}/gi, "[REDACTED_ID_OR_KEY]")
      .slice(0, 1200);
    throw new Error("Salesforce account query failed. " + detail);
  }
}

const playerUrl = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/housie-account/a00g500001DFWqoAAH/housie-test-user-3";
const regressionBoardName = "Transaction Regression - test-user-3";
const regressionAccountRecordId = "a00g500001DFWqoAAH";

function accountSnapshot() {
  const rows = sfQuery<Record<string, unknown>>(
    "SELECT Account_Key__c, Points_Balance__c, Reserved_Points__c FROM Housie_Account__c WHERE Id = '" + regressionAccountRecordId + "'"
  );
  expect(rows).toHaveLength(1);
  return rows[0];
}

function resourceLedgerRows(accountKey: string) {
  return queryBigObject<Record<string, unknown>>(
    "SELECT Account_Id__c, Created_At__c, Record_Id__c FROM Account_Resource_Transaction__b WHERE Account_Id__c = '" + accountKey + "'"
  );
}

test("withdraw active WAITING tickets, release the hold, then purchase again", async ({ page, housie }) => {
  await housie.navigate(playerUrl);
  const hub = page.locator("c-housie-board-hub");
  await expect(hub, "The public account page should render Board Hub").toHaveCount(1, { timeout: 60000 });

  const card = hub.locator("article.board-card").filter({ hasText: regressionBoardName }).first();
  await expect(card, "The dedicated transaction regression board must already exist").toBeVisible({ timeout: 60000 });
  await expect(card, "Withdrawal is only valid while the current game is WAITING").toContainText("Game: WAITING");

  const pendingWithdrawal = card.getByRole("button", { name: "Finish withdrawal", exact: true });
  if (await pendingWithdrawal.count()) {
    await pendingWithdrawal.click();
    await expect(card.getByRole("button", { name: "Finish withdrawal", exact: true }))
      .toHaveCount(0, { timeout: 60000 });
    await housie.note("Recovered the previously prepared withdrawal before starting a fresh regression cycle.");
  }

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
  const beforeTickets = [...before.matchAll(/(?:MANUAL|AUTOMATIC)\s*·\s*([0-9.]+)\s*points\s*·\s*([a-f0-9]{32})/gi)];
  const beforeIds = beforeTickets.map(match => match[2]);
  const beforeReserved = beforeTickets.reduce((total, match) => total + Number(match[1]), 0);
  expect(beforeCount, "The regression fixture must have an active ticket before withdrawal").toBeGreaterThan(0);
  expect(beforeTickets).toHaveLength(beforeCount);

  const accountBefore = accountSnapshot();
  const accountKey = String(accountBefore.Account_Key__c);
  const ledgerBefore = resourceLedgerRows(accountKey);
  const reservedBefore = Number(accountBefore.Reserved_Points__c);
  expect(reservedBefore).toBe(beforeReserved);

  const withdraw = card.getByRole("button", { name: "Withdraw from waiting game", exact: true });
  await expect(withdraw).toBeVisible();
  await withdraw.click();

  await expect.poll(async () => await card.innerText(), { timeout: 60000 })
    .toMatch(/Withdrawal|withdrawn|No active tickets|Buy ticket/i);
  await expect(card.getByText(/Active tickets:\s*[1-9]/)).toHaveCount(0, { timeout: 60000 });
  await expect(card.getByRole("button", { name: "Withdraw from waiting game", exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: /Buy ticket/ })).toBeVisible({ timeout: 30000 });

  const afterWithdrawal = await card.innerText();
  const accountAfterWithdrawal = accountSnapshot();
  const ledgerAfterWithdrawal = resourceLedgerRows(accountKey);
  expect(Number(accountAfterWithdrawal.Reserved_Points__c)).toBe(0);
  expect(ledgerAfterWithdrawal).toHaveLength(ledgerBefore.length + beforeCount);
  housie.note("Post-withdrawal: active tickets=0, reserved points=0, resource ledger rows increased by " + beforeCount + " release entries.");
  housie.note("Post-withdrawal board state: " + afterWithdrawal.slice(0, 2500));
  await housie.screenshot("waiting-ticket-withdrawn");

  await card.getByRole("button", { name: /Buy ticket/ }).click();
  await expect.poll(async () => await card.innerText(), { timeout: 60000 })
    .toMatch(/Ticket:\s*[a-f0-9]{32}/i);
  const afterRepurchase = await card.innerText();
  const afterTickets = [...afterRepurchase.matchAll(/(?:MANUAL|AUTOMATIC)\s*·\s*([0-9.]+)\s*points\s*·\s*([a-f0-9]{32})/gi)];
  const afterIds = afterTickets.map(match => match[2]);
  const newTicketId = afterRepurchase.match(/Ticket:\s*([a-f0-9]{32})/i)?.[1] || afterIds.find(id => !beforeIds.includes(id));
  const replacementTicket = afterTickets.find(match => match[2] === newTicketId);
  expect(newTicketId, "A new active ticket should be created after withdrawal releases the original hold").toMatch(/^[a-f0-9]{32}$/i);
  expect(beforeIds, "The replacement ticket must not reuse a withdrawn ticket ID").not.toContain(newTicketId);
  expect(replacementTicket, "Replacement ticket card should expose its fee").toBeDefined();
  await expect(card.getByRole("button", { name: /Finish ticket purchase|Finish withdrawal/ })).toHaveCount(0);
  const accountAfterRepurchase = accountSnapshot();
  const ledgerAfterRepurchase = resourceLedgerRows(accountKey);
  expect(Number(accountAfterRepurchase.Reserved_Points__c)).toBe(Number(replacementTicket![1]));
  expect(ledgerAfterRepurchase).toHaveLength(ledgerAfterWithdrawal.length + 1);
  await housie.screenshot("waiting-ticket-repurchased");
  housie.note("Withdrawal and repurchase completed. Reserved points returned to 10; ledger has one new reserve row. Ticket identifiers were not retained.");

  await card.getByRole("button", { name: "Withdraw from waiting game", exact: true }).click();
  await expect(card.getByRole("button", { name: /Buy ticket/ })).toBeVisible({ timeout: 60000 });
  await expect(card.getByRole("button", { name: "Withdraw from waiting game", exact: true })).toHaveCount(0);
  const accountAfterFinalRelease = accountSnapshot();
  const ledgerAfterFinalRelease = resourceLedgerRows(accountKey);
  expect(Number(accountAfterFinalRelease.Reserved_Points__c)).toBe(0);
  expect(ledgerAfterFinalRelease).toHaveLength(ledgerAfterRepurchase.length + 1);
  housie.note("Regression fixture cleanup: replacement ticket was withdrawn; reserved points returned to zero and the release ledger row was appended.");
});
