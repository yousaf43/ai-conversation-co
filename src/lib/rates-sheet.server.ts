const SHEET_ID = "1QjCv8q7yj25r1Cmuta6UWqCxamzHvPzDtAr-VqeW2U0";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const CACHE_MS = 60_000;

let cache: { at: number; text: string } | null = null;

/** Reads every tab of the owner's rates sheet as plain text. Cached 60s so edits show up within a minute. */
export async function loadRatesSheet(): Promise<string | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.text;
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const sheetsKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovableKey || !sheetsKey) return cache?.text ?? null;
  const headers = { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": sheetsKey };
  try {
    const metaRes = await fetch(`${GATEWAY}/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`, { headers });
    if (!metaRes.ok) throw new Error(`meta [${metaRes.status}]: ${await metaRes.text()}`);
    const meta = (await metaRes.json()) as { sheets: { properties: { title: string } }[] };
    const ranges = meta.sheets.map((s) => `ranges='${s.properties.title.replace(/'/g, "''")}'!A1:Z500`).join("&");
    const res = await fetch(`${GATEWAY}/spreadsheets/${SHEET_ID}/values:batchGet?${ranges}`, { headers });
    if (!res.ok) throw new Error(`values [${res.status}]: ${await res.text()}`);
    const data = (await res.json()) as { valueRanges: { range: string; values?: string[][] }[] };
    const text = data.valueRanges
      .map((vr) => {
        const rows = (vr.values ?? [])
          .map((r) => r.map((c) => String(c).trim()).filter(Boolean).join(" | "))
          .filter(Boolean);
        return `### ${vr.range.split("!")[0]}\n${rows.join("\n")}`;
      })
      .join("\n\n");
    cache = { at: Date.now(), text };
    return text;
  } catch (e) {
    console.error("Rates sheet load failed:", e);
    return cache?.text ?? null;
  }
}
