const safeUrl = value => {
  try {
    const url = new URL(value);
    for (const key of ["sid", "access_token", "token", "code", "frontdoor"]) {
      if (url.searchParams.has(key)) url.searchParams.set(key, "[REDACTED]");
    }
    return url.toString();
  } catch { return "[unparseable-url]"; }
};

export function captureBrowserDiagnostics(page, { maxEvents = 500 } = {}) {
  if (!page || typeof page.on !== "function" || typeof page.off !== "function") {
    throw new Error("A Playwright-compatible page is required.");
  }
  if (!Number.isInteger(maxEvents) || maxEvents < 1) throw new Error("maxEvents must be a positive integer.");
  const events = [];
  const record = (type, message, extra = {}) => {
    events.push({ timestamp: new Date().toISOString(), type, message, ...extra });
    if (events.length > maxEvents) events.shift();
  };
  const onConsole = message => { if (message.type() === "error") record("console-error", message.text()); };
  const onPageError = error => record("page-error", error.message);
  const onRequestFailed = request => record("request-failed", request.failure()?.errorText || "Request failed", {
    url: safeUrl(request.url()), method: request.method()
  });
  const onResponse = response => {
    if (response.status() >= 400) record("http-error", "HTTP " + response.status(), {
      url: safeUrl(response.url()), status: response.status(), method: response.request().method()
    });
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);
  return {
    note(message) { record("scenario-note", String(message)); },
    snapshot() { return events.slice(); },
    stop() {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onRequestFailed);
      page.off("response", onResponse);
    }
  };
}
