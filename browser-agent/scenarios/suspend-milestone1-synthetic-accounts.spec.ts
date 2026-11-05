import { execFileSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";
import { redactAccountKey } from "../utilities/salesforce";

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

test("release active tickets and suspend only Milestone 1 synthetic purchase accounts", async ({ page, housie }) => {
  const soql = "SELECT Id, Account_Key__c, Display_Name__c, Status__c FROM Housie_Account__c WHERE " +
    "Display_Name__c LIKE 'M1 Purchase %'";
  const result = sfJson(["data", "query", "--query", soql, "--target-org", "housie-browser-agent", "--json"]);
  const rows = Array.isArray(result?.records) ? result.records : [];
  let cleaned = 0;
  for (const row of rows) {
    if (row.Status__c !== "SUSPENDED") {
      const key = String(row.Account_Key__c || "");
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
      const cards = hub.locator("article.board-card");
      for (let index = await cards.count() - 1; index >= 0; index--) {
        const card = cards.nth(index);
        const pending = card.getByRole("button", { name: /Finish ticket purchase|Finish withdrawal/ });
        if (await pending.count()) {
          await pending.first().click();
          await expect(card.getByRole("button", { name: /Finish ticket purchase|Finish withdrawal/ })).toHaveCount(0, { timeout: 60000 });
        }
        const cardText = await card.innerText();
        const activeCount = Number(cardText.match(/Active tickets:\s*(\d+)/)?.[1] || 0);
        if (activeCount > 0) {
          if (!cardText.includes("Game: WAITING")) {
            throw new Error("Refusing to suspend a synthetic account with active tickets in a non-WAITING game.");
          }
          await card.getByRole("button", { name: "Withdraw from waiting game", exact: true }).click();
          await expect(card.getByText("Active tickets: 0", { exact: true })).toBeVisible({ timeout: 60000 });
        }
        await card.getByRole("button", { name: "Leave board", exact: true }).click();
        await expect(card).toHaveCount(0, { timeout: 60000 });
      }
      const accountAfterRelease = sfJson(["data", "query", "--query",
        "SELECT Reserved_Points__c FROM Housie_Account__c WHERE Id = '" + String(row.Id) + "'",
        "--target-org", "housie-browser-agent", "--json"]);
      const balanceRows = Array.isArray(accountAfterRelease?.records) ? accountAfterRelease.records : [];
      expect(balanceRows).toHaveLength(1);
      expect(Number(balanceRows[0].Reserved_Points__c)).toBe(0);
      sfJson(["data", "update", "record", "--sobject", "Housie_Account__c",
        "--record-id", String(row.Id), "--values", "Status__c=SUSPENDED",
        "--target-org", "housie-browser-agent", "--json"]);
    }
    const verify = sfJson(["data", "query", "--query",
      "SELECT Status__c FROM Housie_Account__c WHERE Id = '" + String(row.Id) + "'",
      "--target-org", "housie-browser-agent", "--json"]);
    const verified = Array.isArray(verify?.records) ? verify.records : [];
    expect(verified).toHaveLength(1);
    expect(verified[0].Status__c).toBe("SUSPENDED");
    cleaned++;
  }
  housie.note("Verified " + cleaned + " M1 Purchase synthetic accounts are SUSPENDED after any WAITING tickets were withdrawn, reserved balances returned to zero, and board memberships were left. No keys or emails were retained.");
});
