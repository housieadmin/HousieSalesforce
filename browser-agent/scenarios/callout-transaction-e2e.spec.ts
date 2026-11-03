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
        const requestBody = request.postData() || "";
        const requestJson = JSON.parse(requestBody);
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

  const purchase = hub.getByRole("button", { name: /Buy ticket/ }).first();
  await expect(purchase, "A waiting game must be available for this account").toBeVisible({ timeout: 30000 });
  capturePurchase = true;
  await purchase.click();

  await expect.poll(async () => await hub.innerText(), { timeout: 60000 }).toMatch(/Ticket:|Ticket purchase failed during/);
  const result = await hub.innerText();
  await Promise.all(pendingCaptures);
  housie.note("Ticket purchase UI result: " + result.slice(0, 1500));
  housie.note("Salesforce Aura purchase diagnostics: " + JSON.stringify(auraDiagnostics).slice(0, 7000));
  await housie.screenshot("ticket-purchase-stage-diagnostic");
  expect(result, "Ticket purchase must complete without a transaction-stage error").toMatch(/Ticket:/);
});
