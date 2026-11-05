import { spawnSync } from "node:child_process";
import path from "node:path";
import { test, expect } from "../core";
import { queryBigObject } from "../utilities/salesforce";

test.use({ trace: "off" });

function safeText(value: unknown): string {
  return String(value ?? "")
    .replace(/[a-f0-9]{32}/gi, "[REDACTED_ID_OR_KEY]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]")
    .slice(0, 1800);
}

function sfQuery<T extends Record<string, unknown>>(soql: string): T[] {
  const result = spawnSync("sf", [
    "data", "query", "--query", soql, "--target-org", "housie-browser-agent", "--json"
  ], { cwd: path.resolve(process.cwd(), ".."), encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  const streams = [String(result.stdout ?? ""), String(result.stderr ?? "")];
  for (const raw of streams) {
    const clean = raw.replace(/\u001b\[[0-9;]*m/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      const parsed = JSON.parse(clean.slice(start, end + 1));
      if (parsed.status === 0 && Array.isArray(parsed.result?.records)) {
        return parsed.result.records as T[];
      }
      throw new Error(safeText(parsed.message || parsed.name || "Salesforce query returned a non-zero status."));
    } catch (error) {
      if (error instanceof SyntaxError) continue;
      throw new Error("Salesforce query failed. " + safeText(error));
    }
  }
  throw new Error("Salesforce query returned no parseable JSON. " + safeText(streams.join("\n")));
}

test("inspect only M1 Purchase account financial cleanup state", async ({ housie }) => {
  const accounts = sfQuery<Record<string, unknown>>(
    "SELECT Id, Account_Key__c, Display_Name__c, Status__c, Points_Balance__c, Reserved_Points__c " +
    "FROM Housie_Account__c WHERE Display_Name__c LIKE 'M1 Purchase %'"
  );
  const report = [];
  for (const account of accounts) {
    const key = String(account.Account_Key__c);
    const commands = sfQuery<Record<string, unknown>>(
      "SELECT Action_Type__c, Entry_Fee__c, Status__c, Board_Id__c, Game_Id__c " +
      "FROM Housie_Ticket_Command__c WHERE Account_Key__c = '" + key + "' LIMIT 20"
    );
    const holds = queryBigObject<Record<string, unknown>>(
      "SELECT Account_Id__c, Game_Id__c, Record_Id__c FROM Wallet_Hold__b WHERE Account_Id__c = '" + key + "'"
    );
    const ledger = queryBigObject<Record<string, unknown>>(
      "SELECT Account_Id__c, Created_At__c, Record_Id__c FROM Account_Resource_Transaction__b WHERE Account_Id__c = '" + key + "'"
    );
    report.push({
      fixture: String(account.Display_Name__c).split(" ").slice(-1)[0],
      status: account.Status__c,
      balance: Number(account.Points_Balance__c),
      reserved: Number(account.Reserved_Points__c),
      commands: commands.map(command => ({
        action: command.Action_Type__c,
        entryFee: Number(command.Entry_Fee__c || 0),
        status: command.Status__c,
        boardIdPresent: Boolean(command.Board_Id__c),
        gameIdPresent: Boolean(command.Game_Id__c)
      })),
      walletHoldRows: holds.length,
      resourceLedgerRows: ledger.length
    });
  }
  housie.note("M1 Purchase cleanup diagnostic (no account keys, IDs, emails or ticket IDs): " + JSON.stringify(report));
  expect(report.length).toBeGreaterThan(0);
});
