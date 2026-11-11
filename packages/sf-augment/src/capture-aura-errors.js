export function captureAuraErrors(page, { maxEntries = 100 } = {}) {
  if (!page || typeof page.on !== "function" || typeof page.off !== "function") {
    throw new Error("A Playwright-compatible page is required.");
  }
  if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error("maxEntries must be a positive integer.");
  const pending = [];
  const onResponse = response => {
    if (!/\/sfsites\/aura(?:\?|$)/.test(response.url()) || response.request().method() !== "POST") return;
    const capture = (async () => {
      const entry = { status: response.status(), errors: [] };
      try {
        const payload = JSON.parse(await response.text());
        const visit = value => {
          if (!value || typeof value !== "object") return;
          if (Array.isArray(value)) { value.forEach(visit); return; }
          for (const [key, candidate] of Object.entries(value)) {
            if (["message", "exceptionMessage", "errorCode", "state"].includes(key) &&
              typeof candidate === "string" &&
              /error|exception|fail|invalid|denied|not enough|limit|required/i.test(candidate)) {
              entry.errors.push(key + ": " + candidate.slice(0, 1200));
            }
            visit(candidate);
          }
        };
        visit(payload);
      } catch (error) {
        entry.errors.push("Unable to parse Aura response: " + String(error).slice(0, 250));
      }
      return entry;
    })();
    pending.push(capture);
    if (pending.length > maxEntries) pending.shift();
  };
  page.on("response", onResponse);
  return {
    async snapshot() { return Promise.all(pending); },
    stop() { page.off("response", onResponse); }
  };
}
