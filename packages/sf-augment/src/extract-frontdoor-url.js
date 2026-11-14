export function extractFrontdoorUrl(raw) {
  const clean = String(raw).replace(/\u001b\[[0-9;]*m/g, "").trim();
  const start = clean.indexOf("{");
  if (start < 0) throw new Error("Salesforce CLI did not return JSON for the frontdoor URL.");
  let result;
  try { result = JSON.parse(clean.slice(start)); }
  catch { throw new Error("Salesforce CLI returned invalid JSON for the frontdoor URL."); }
  const value = result?.result?.url;
  let url;
  try { url = new URL(value); } catch {}
  if (!url || url.protocol !== "https:") throw new Error("Salesforce CLI did not return a valid HTTPS frontdoor URL.");
  return value;
}
