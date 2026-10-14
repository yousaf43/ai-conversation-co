const SHEET_ID = "1QjCv8q7yj25r1Cmuta6UWqCxamzHvPzDtAr-VqeW2U0";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const TAB = "Leads";
const HEADERS = ["Phone", "Name", "City", "Stage", "Interest", "Monthly bill / units", "Budget", "Panels", "Summary", "Last update"];

let tabReady = false;

function auth() {
  const a = process.env["LOVABLE_API_KEY"];
  const b = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!a || !b) return null;
  return { Authorization: `Bearer ${a}`, "X-Connection-Api-Key": b, "Content-Type": "application/json" };
}

async function call(path: string, init: RequestInit) {
  const res = await fetch(`${GATEWAY}/spreadsheets/${SHEET_ID}${path}`, init);
  if (!res.ok) throw new Error(`Sheets [${res.status}]: ${await res.text()}`);
  return res.json();
}

async function ensureTab(headers: Record<string, string>) {
  if (tabReady) return;
  const meta = (await call("?fields=sheets.properties.title", { headers })) as { sheets: { properties: { title: string } }[] };
  if (!meta.sheets.some((s) => s.properties.title === TAB)) {
    await call(":batchUpdate", { method: "POST", headers, body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB } } }] }) });
    await call(`/values/${TAB}!A1:J1?valueInputOption=RAW`, { method: "PUT", headers, body: JSON.stringify({ values: [HEADERS] }) });
  }
  tabReady = true;
}

export type Lead = { name?: string; city?: string; interest?: string; bill?: string; budget?: string; panels?: string };

/** Writes or updates one row per customer in the "Leads" tab. Returns the row number used. */
export async function upsertLeadRow(input: {
  row: number | null; phone: string; stage: string; summary: string; lead: Lead; fallbackName: string;
}): Promise<number | null> {
  const headers = auth();
  if (!headers) return input.row;
  await ensureTab(headers);
  const l = input.lead;
  const values = [[
    input.phone, l.name || input.fallbackName, l.city ?? "", input.stage, l.interest ?? "", l.bill ?? "",
    l.budget ?? "", l.panels ?? "", input.summary, new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" }),
  ]];
  if (input.row) {
    await call(`/values/${TAB}!A${input.row}:J${input.row}?valueInputOption=RAW`, { method: "PUT", headers, body: JSON.stringify({ values }) });
    return input.row;
  }
  const r = (await call(`/values/${TAB}!A:J:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST", headers, body: JSON.stringify({ values }),
  })) as { updates?: { updatedRange?: string } };
  const m = r.updates?.updatedRange?.match(/!A(\d+)/);
  return m ? Number(m[1]) : null;
}
