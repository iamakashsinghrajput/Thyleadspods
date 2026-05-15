export type SheetTab = { title: string; sheetId: number; rowCount: number; columnCount: number };

export function parseSpreadsheetId(input: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return "";
}

export function parseGidFromUrl(input: string): number | null {
  const m = (input || "").match(/[#?&]gid=(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function apiKey(): string {
  const k = process.env.GOOGLE_API_KEY || process.env.GOOGLE_SHEETS_API_KEY || "";
  if (!k) throw new Error("GOOGLE_API_KEY env var missing");
  return k;
}

export async function listTabs(spreadsheetId: string): Promise<SheetTab[]> {
  const key = apiKey();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?key=${encodeURIComponent(key)}&fields=sheets.properties`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Sheets metadata failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { sheets?: Array<{ properties?: { title?: string; sheetId?: number; gridProperties?: { rowCount?: number; columnCount?: number } } }> };
  const tabs = (json.sheets || []).map((s) => ({
    title: s.properties?.title || "",
    sheetId: s.properties?.sheetId ?? 0,
    rowCount: s.properties?.gridProperties?.rowCount ?? 0,
    columnCount: s.properties?.gridProperties?.columnCount ?? 0,
  })).filter((t) => t.title);
  return tabs;
}

export async function fetchTabRows(spreadsheetId: string, tabTitle: string): Promise<Record<string, unknown>[]> {
  const key = apiKey();
  const range = encodeURIComponent(tabTitle);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}?key=${encodeURIComponent(key)}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Sheets values failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { values?: unknown[][] };
  const values = json.values || [];
  if (values.length === 0) return [];
  const headers = (values[0] as unknown[]).map((h) => String(h ?? "").trim());
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < values.length; i++) {
    const r = values[i] as unknown[];
    const obj: Record<string, unknown> = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] || `col${c + 1}`;
      obj[key] = r[c] ?? "";
    }
    rows.push(obj);
  }
  return rows;
}

export function isApiKeyConfigured(): boolean {
  return !!(process.env.GOOGLE_API_KEY || process.env.GOOGLE_SHEETS_API_KEY);
}
