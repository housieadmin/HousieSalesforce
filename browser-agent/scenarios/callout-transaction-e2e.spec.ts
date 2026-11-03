import { test, expect } from "../core";

const site = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s";
const playerUrl = site + "/housie-account/a00g500001D7iIrAAJ/housie-test-user-2";

test("public test-user ticket purchase reports exact failing transaction stage", async ({ page, housie }) => {
  const auraDiagnostics = [];
  const pendingCaptures = [];
  let capturePurchase = false;

  page.on("response", response => {
    if (!capturePurchase || !/\/sfsites\/aura(?:\?|$)/.test(response.url())) return;
    const request = response.request();
    if (request.method() !== "POST") return;

    pendingCaptures.push((async () => {
      const entry = { status: response.status(), method: request.method(), actionDescriptors: [], responseFields: [] };
      try {
        const requestJson = JSON.parse(request.postData() || "");
        const collectDescriptors = value => {
          if (!value || typeof value !== "object") return;
          if (Array.isArray(value)) return value.forEach(collectDescriptors);
          if (typeof value.descriptor === "string") entry.actionDescriptors.push(value.descriptor);
          Object.values(value).forEach(collectDescriptors);
        };
        collectDescriptors(requestJson);
      } catch {}

      try {
        const responseJson = JSON.parse(await response.text());
        const collectErrors = (value, path = "$") => {
          if (!value || typeof value !== "object") return;
          if (Array.isArray(value)) return value.forEach((item, index) => collectErrors(item, path + "[" + index + "]"));
          const summary = {};
          for (const key of ["state", "status", "type", "errorCode", "message", "exceptionMessage", "stackTrace"]) {
            if (typeof value[key] === "string" || typeof value[key] === "number") summary[key] = String(value[key]).slice(0, 2000);
          }
          if (Object.keys(summary).length) entry.responseFields.push({ path, ...summary });
          Object.entries(value).forEach(([key, child]) => collectErrors(child, path + "." + key));
        };
        collectErrors(responseJson);
      } catch (error) {
        entry.parseError = String(error).slice(0, 300);
      }
      auraDiagnostics.push(entry);
    })().catch(error => auraDiagnostics.push({ captureError: String(error).slice(0, 500) })));
  });

  await housie.navigate(playerUrl);
  const hub = page.locator("c-housie-board-hub");
  await expect(hub, "Public account page should render Board Hub").toHaveCount(1, { timeout: 60000 });
  await expect(hub.getByText("Your boards", { exact: true })).toBeVisible({ timeout: 60000 });

  capturePurchase = true;
  const finishPending = hub.getByRole("button", { name: /Finish ticket purchase/ }).first();
  if (await finishPending.count()) {
    await finishPending.click();
    await expect(hub.getByRole("button", { name: /Finish ticket purchase/ })).toHaveCount(0, { timeout: 60000 });
    const recovered = await hub.innerText();
    housie.note("Pending purchase finalization result: " + recovered.slice(0, 1200));
    expect(recovered, "Pending purchase must finalize without a transaction error").not.toMatch(/pending uncommitted work/i);
  }

  let result = await hub.innerText();
  let ticketId = result.match(/\b(?:MANUAL|AUTO) · [0-9.]+ points · ([a-f0-9]{32})/i)?.[1]
    || result.match(/Ticket:\s*([a-f0-9]{32})/i)?.[1];

  // Only create a ticket when this test account has none. This keeps hourly
  // reruns read-only after the first successful purchase and avoids exhausting
  // the account's ticket limit.
  const activeMatch = result.match(/Active tickets:\s*(\d+)/);
  if (!ticketId && Number(activeMatch?.[1] || 0) === 0) {
    const purchase = hub.getByRole("button", { name: /Buy ticket/ }).first();
    await expect(purchase, "A waiting game must be available for this account").toBeVisible({ timeout: 30000 });
    await page.evaluate(() => {
      const w = window as any;
      w.__housieE2eOriginalDateNow = Date.now;
      w.__housieE2eOriginalRandom = Math.random;
      Date.now = () => 1900000000000;
      Math.random = () => 0.3141592653589793;
    });
    await purchase.click();
    await page.evaluate(() => {
      const w = window as any;
      Date.now = w.__housieE2eOriginalDateNow;
      Math.random = w.__housieE2eOriginalRandom;
      delete w.__housieE2eOriginalDateNow;
      delete w.__housieE2eOriginalRandom;
    });
    await expect.poll(async () => await hub.innerText(), { timeout: 60000 }).toMatch(/Ticket:|Ticket purchase failed during/);
    result = await hub.innerText();
    ticketId = result.match(/Ticket:\s*([a-f0-9]{32})/i)?.[1]
      || result.match(/\b(?:MANUAL|AUTO) · [0-9.]+ points · ([a-f0-9]{32})/i)?.[1];
  }

  expect(ticketId, "The public account must show an active ticket result").toMatch(/^[a-f0-9]{32}$/i);
  result += "\nTicket: " + ticketId;
  await Promise.all(pendingCaptures);
  housie.note("Ticket purchase UI result: " + result.slice(0, 1500));
  housie.note("Salesforce Aura purchase diagnostics: " + JSON.stringify(auraDiagnostics).slice(0, 7000));
  await housie.screenshot("ticket-purchase-stage-diagnostic");
  expect(result, "Ticket purchase must complete without a transaction-stage error").toMatch(/Ticket:/);
  expect(result, "The pending-uncommitted-work failure must be absent").not.toMatch(/pending uncommitted work/i);
  expect(JSON.stringify(auraDiagnostics), "No Salesforce Aura action may report pending uncommitted work").not.toMatch(/pending uncommitted work/i);
});
