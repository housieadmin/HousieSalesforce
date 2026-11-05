import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";
import { redactAccountKey, queryBigObject } from "../utilities/salesforce";

// These scenarios handle bearer account keys; do not retain Playwright traces on failure.
test.use({ trace: "off" });

function sfJson(args: string[]) {
  try {
    const output = execFileSync("sf", args, {
      cwd: path.resolve(process.cwd(), ".."),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    const clean = output.replace(/\u001b\[[0-9;]*m/g, "").trim();
    const start = clean.indexOf("{");
    if (start < 0) throw new Error("Salesforce CLI did not return JSON.");
    const parsed = JSON.parse(clean.slice(start));
    if (parsed.status !== 0) throw new Error("Salesforce CLI returned a non-zero status.");
    return parsed.result;
  } catch {
    throw new Error("Synthetic-account cleanup command failed; no account keys or emails were captured.");
  }
}

function queryRecords(soql: string) {
  const result = sfJson(["data", "query", "--query", soql, "--target-org", "housie-browser-agent", "--json"]);
  return Array.isArray(result?.records) ? result.records : [];
}

test("release active tickets and suspend only Milestone 1 synthetic purchase accounts", async ({ page, housie }) => {
  const rows = queryRecords(
    "SELECT Id, Account_Key__c, Display_Name__c, Status__c FROM Housie_Account__c " +
    "WHERE Display_Name__c LIKE 'M1 Purchase %'"
  ).sort((a, b) => String(a.Display_Name__c).localeCompare(String(b.Display_Name__c)));
  let cleaned = 0;
  for (const row of rows) {
    const key = String(row.Account_Key__c || "");
    const commands = queryRecords(
      "SELECT Action_Type__c, Status__c, Board_Id__c, Game_Id__c FROM Housie_Ticket_Command__c " +
      "WHERE Account_Key__c = '" + key + "'"
    );
    const committedPurchases = commands.filter(command =>
      command.Action_Type__c === "PURCHASE" && command.Status__c === "COMMITTED"
    ).length;
    let committedWithdrawals = commands.filter(command =>
      command.Action_Type__c === "WITHDRAW" && command.Status__c === "COMMITTED"
    ).length;
    const purchase = commands.find(command =>
      command.Action_Type__c === "PURCHASE" && command.Status__c === "COMMITTED"
    );
    expect(purchase, "Each M1 Purchase account must have a committed purchase command").toBeTruthy();
    const boardId = String(purchase.Board_Id__c);
    const gameId = String(purchase.Game_Id__c);
    const outstandingTicket = committedPurchases > committedWithdrawals;

    if (row.Status__c !== "SUSPENDED") {
      expect(key).toMatch(/^[a-f0-9]{32}$/i);
      const root = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s/";
      await page.goto(root + "?token=" + encodeURIComponent(key), { waitUntil: "domcontentloaded" });
      const app = page.locator("c-housie-app");
      await expect(app).toHaveCount(1, { timeout: 60000 });
      await redactAccountKey(page);
      await page.evaluate(() => history.replaceState(null, "", location.pathname));
      await expect(app.getByText("Welcome, " + String(row.Display_Name__c), { exact: true })).toBeVisible({ timeout: 60000 });
      const hub = app.locator("c-housie-board-hub");
      await expect(hub).toHaveCount(1, { timeout: 30000 });
      let card = hub.locator("article.board-card").filter({ hasText: boardId });
      if (outstandingTicket) {
        if (await card.count() === 0) {
          await hub.getByRole("textbox", { name: "Invitation board ID", exact: true }).fill(boardId);
          await hub.getByRole("button", { name: "Join board", exact: true }).click();
          await expect(card).toHaveCount(1, { timeout: 60000 });
        }
        const pending = card.getByRole("button", { name: /Finish ticket purchase|Finish withdrawal/ });
        if (await pending.count()) {
          await pending.first().click();
          await expect(card.getByRole("button", { name: /Finish ticket purchase|Finish withdrawal/ })).toHaveCount(0, { timeout: 60000 });
        }
        const cardText = await card.innerText();
        const activeCount = Number(cardText.match(/Active tickets:\s*(\d+)/)?.[1] || 0);
        expect(activeCount, "A committed purchase without a matching withdrawal must still have an active ticket").toBeGreaterThan(0);
        if (!cardText.includes("Game: WAITING")) {
          throw new Error("Refusing to suspend a synthetic account with active tickets in a non-WAITING game.");
        }
        await card.getByRole("button", { name: "Withdraw from waiting game", exact: true }).click();
        await expect(card.getByText("Active tickets: 0", { exact: true })).toBeVisible({ timeout: 60000 });
        await expect(app.getByText(/All ticket holds were released/)).toBeVisible({ timeout: 60000 });
        const afterCommands = queryRecords(
          "SELECT Action_Type__c, Status__c FROM Housie_Ticket_Command__c WHERE Account_Key__c = '" + key + "'"
        );
        committedWithdrawals = afterCommands.filter(command =>
          command.Action_Type__c === "WITHDRAW" && command.Status__c === "COMMITTED"
        ).length;
        expect(committedWithdrawals).toBe(committedPurchases);
      } else if (await card.count() > 0) {
        await card.getByRole("button", { name: "Leave board", exact: true }).click();
        await expect(card).toHaveCount(0, { timeout: 60000 });
      }

      const reserved = queryRecords(
        "SELECT Reserved_Points__c FROM Housie_Account__c WHERE Id = '" + String(row.Id) + "'"
      );
      expect(reserved).toHaveLength(1);
      expect(Number(reserved[0].Reserved_Points__c)).toBe(0);
      const holds = queryBigObject<Record<string, unknown>>(
        "SELECT Account_Id__c, Game_Id__c, Record_Id__c FROM Wallet_Hold__b " +
        "WHERE Account_Id__c = '" + key + "' AND Game_Id__c = '" + gameId + "'"
      );
      expect(holds).toHaveLength(committedPurchases + committedWithdrawals);
      const ledger = queryBigObject<Record<string, unknown>>(
        "SELECT Account_Id__c, Created_At__c, Record_Id__c FROM Account_Resource_Transaction__b " +
        "WHERE Account_Id__c = '" + key + "'"
      );
      expect(ledger).toHaveLength(4 + committedPurchases + committedWithdrawals);
      sfJson(["data", "update", "record", "--sobject", "Housie_Account__c",
        "--record-id", String(row.Id), "--values", "Status__c=SUSPENDED",
        "--target-org", "housie-browser-agent", "--json"]);
    }
    const verify = queryRecords(
      "SELECT Status__c, Reserved_Points__c FROM Housie_Account__c WHERE Id = '" + String(row.Id) + "'"
    );
    expect(verify).toHaveLength(1);
    expect(verify[0].Status__c).toBe("SUSPENDED");
    expect(Number(verify[0].Reserved_Points__c)).toBe(0);
    cleaned++;
  }
  housie.note("Verified " + cleaned + " M1 Purchase synthetic accounts have no outstanding committed tickets, zero reserved points, matching append-only hold and resource-ledger counts, and SUSPENDED status. No keys or emails were retained.");
});
