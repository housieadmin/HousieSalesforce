import { test, expect } from "../core";

const site = "https://empathetic-otter-ht8sln-dev-ed.trailblaze.my.site.com/housie/s";
const playerUrl = site + "/housie-account/a00g500001D7iIrAAJ/housie-test-user-2";

test("public test-user recovers pending purchase and creates a fresh ticket when capacity remains", async ({ page, housie }) => {
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

  const visiblePageText = async () => {
    const bodyText = await page.locator("body").innerText();
    const activeText = await page.getByText(/Active tickets:\s*\d+/).first().innerText().catch(() => "");
    const ticketText = await page.getByText(/(?:MANUAL|AUTO)\s*·\s*[0-9.]+\s*points\s*·\s*[a-f0-9]{32}/i).first().innerText().catch(() => "");
    return [bodyText, activeText, ticketText].filter(Boolean).join("\n");
  };

  capturePurchase = true;
  const pendingBanner = page.getByText("A previous action is prepared and needs to be finalized.", { exact: true });
  const finishPending = page.getByRole("button", { name: /Finish ticket purchase/ }).first();
  const purchaseButton = page.getByRole("button", { name: /Buy ticket/ }).first();

  // The Board Hub heading renders before its asynchronous board/action data.
  // Wait for the actual board card and one of its actionable states before
  // deciding whether a pending command needs recovery.
  await expect(page.getByRole("heading", { name: "B-0001", exact: true })).toBeVisible({ timeout: 60000 });
  await expect.poll(async () => {
    return await pendingBanner.isVisible().catch(() => false)
      || await finishPending.isVisible().catch(() => false)
      || await purchaseButton.isVisible().catch(() => false);
  }, { timeout: 60000 }).toBe(true);

  if (await pendingBanner.isVisible().catch(() => false)
      || await finishPending.isVisible().catch(() => false)) {
    await expect(finishPending, "A prepared command must expose its recovery action").toBeVisible({ timeout: 30000 });
    await finishPending.click();
    await expect(finishPending).toHaveCount(0, { timeout: 60000 });
    await expect(pendingBanner).toHaveCount(0, { timeout: 60000 });
    const recovered = await visiblePageText();
    housie.note("Pending purchase finalization result: " + recovered.slice(0, 1500));
    expect(recovered, "Pending purchase must finalize without a transaction error").not.toMatch(/pending uncommitted work/i);
  }

  let result = await visiblePageText();
  const initialActiveCount = Number(result.match(/Active tickets:\s*(\d+)/)?.[1] || 0);
  const initialTicketIds = [...result.matchAll(/(?:MANUAL|AUTO)\s*·\s*[0-9.]+\s*points\s*·\s*([a-f0-9]{32})/gi)]
    .map(match => match[1]);
  let ticketId = result.match(/Ticket:\s*([a-f0-9]{32})/i)?.[1]
    || initialTicketIds[0];

  // The account is configured for two human tickets per game. Buy one more
  // only while capacity remains; once full, repeat runs become read-only.
  // Use the real request ID generator so this exercises a genuinely new
  // prepare -> commit -> complete command rather than replaying an old ID.
  if (initialActiveCount < 2) {
    const purchase = page.getByRole("button", { name: /Buy ticket/ }).first();
    await expect(purchase, "A waiting game must be available for this account").toBeVisible({ timeout: 30000 });
    await purchase.click();

    await expect.poll(async () => {
      const text = await visiblePageText();
      return /Ticket:\s*[a-f0-9]{32}|A callout was unsuccessful|pending uncommitted work|maximum number of tickets|Not enough available points/i.test(text);
    }, { timeout: 60000 }).toBe(true);

    result = await visiblePageText();
    const successId = result.match(/Ticket:\s*([a-f0-9]{32})/i)?.[1];
    expect(successId, "A fresh purchase must return its own Ticket ID, not only reuse an existing ticket").toMatch(/^[a-f0-9]{32}$/i);
    expect(initialTicketIds, "A fresh purchase must create a distinct ticket").not.toContain(successId);
    ticketId = successId;

    await expect.poll(async () => {
      const text = await visiblePageText();
      return Number(text.match(/Active tickets:\s*(\d+)/)?.[1] || 0);
    }, { timeout: 60000 }).toBeGreaterThan(initialActiveCount);
  }

  expect(ticketId, "The public account must show an active ticket result").toMatch(/^[a-f0-9]{32}$/i);
  result = await visiblePageText() + "\nTicket: " + ticketId;
  expect(await page.getByRole("button", { name: /Finish ticket purchase/ }).count(),
    "No prepared purchase may remain after the test").toBe(0);

  await Promise.all(pendingCaptures);
  housie.note("Ticket purchase UI result: " + result.slice(0, 2000));
  housie.note("Salesforce Aura purchase diagnostics: " + JSON.stringify(auraDiagnostics).slice(0, 7000));
  await housie.screenshot("ticket-purchase-stage-diagnostic");
  expect(result, "Ticket purchase must complete without a transaction-stage error").toMatch(/Ticket:/);
  expect(result, "The pending-uncommitted-work failure must be absent").not.toMatch(/pending uncommitted work/i);
  expect(JSON.stringify(auraDiagnostics), "No Salesforce Aura action may report pending uncommitted work").not.toMatch(/pending uncommitted work/i);
});
