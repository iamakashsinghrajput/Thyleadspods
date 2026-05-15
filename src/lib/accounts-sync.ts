import AccountsSheet from "@/lib/models/accounts-sheet";
import { fetchTabRows } from "@/lib/google-sheets";
import { normalizeDomain, rootKeyFor } from "@/lib/accounts-domain";

const DOMAIN_NEEDLES = ["domain", "website", "url", "site"];
const COMPANY_NEEDLES = ["company", "account", "organization", "organisation", "brand", "client"];
const COMPANY_NAME_ONLY_NEEDLES = ["name"];

function detectColumn(headers: string[], needles: string[]): string | null {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const needle of needles) {
    const idx = lower.indexOf(needle);
    if (idx >= 0) return headers[idx];
  }
  for (const needle of needles) {
    const idx = lower.findIndex((h) => h.includes(needle));
    if (idx >= 0) return headers[idx];
  }
  return null;
}

export type SyncResult = {
  uploaded: number;
  uniqueDomains: number;
  skippedNoDomain: number;
  domainColumn: string;
  companyColumn: string | null;
  headers: string[];
};

export async function syncFromGoogleSheet(args: {
  projectId: string;
  spreadsheetId: string;
  tabTitle: string;
  tabSheetId?: number | null;
  sheetUrl?: string;
  actor?: string;
}): Promise<SyncResult> {
  const rawRows = await fetchTabRows(args.spreadsheetId, args.tabTitle);
  if (rawRows.length === 0) {
    throw new Error("Tab has no rows after header");
  }

  const headers = Object.keys(rawRows[0] || {});
  const domainCol = detectColumn(headers, DOMAIN_NEEDLES);
  if (!domainCol) {
    const err = new Error("Could not find a Domain column in the selected tab.");
    (err as unknown as { detectedHeaders?: string[] }).detectedHeaders = headers;
    throw err;
  }
  const companyCol = detectColumn(headers, COMPANY_NEEDLES) || detectColumn(headers, COMPANY_NAME_ONLY_NEEDLES);

  const parsed: { domain: string; company: string; dnc: boolean; rootKey: string }[] = [];
  const seen = new Set<string>();
  let skippedNoDomain = 0;

  for (const r of rawRows) {
    const rawDomain = String(r[domainCol] ?? "").trim();
    const domain = normalizeDomain(rawDomain);
    if (!domain) { skippedNoDomain++; continue; }
    if (seen.has(domain)) continue;
    seen.add(domain);
    const company = companyCol ? String(r[companyCol] ?? "").trim() : "";
    parsed.push({ domain, company, dnc: false, rootKey: rootKeyFor(domain) });
  }

  const uniqueDomains = new Set(parsed.map((r) => r.rootKey)).size;

  const existing = await AccountsSheet.findOne({ projectId: args.projectId }).select("_id googleSheet.connectedAt googleSheet.sheetUrl").lean<{ _id: unknown; googleSheet?: { connectedAt?: Date | null; sheetUrl?: string } }>();

  const googleSheetDoc = {
    sheetUrl: args.sheetUrl || existing?.googleSheet?.sheetUrl || "",
    spreadsheetId: args.spreadsheetId,
    tabTitle: args.tabTitle,
    tabSheetId: typeof args.tabSheetId === "number" ? args.tabSheetId : null,
    connectedAt: existing?.googleSheet?.connectedAt || new Date(),
    connectedBy: args.actor?.toLowerCase() || "",
    lastSyncAt: new Date(),
    lastSyncError: "",
    domainColumn: domainCol,
    companyColumn: companyCol || "",
  };

  const $set: Record<string, unknown> = {
    rows: parsed,
    totals: { uploaded: parsed.length, dnc: 0, net: parsed.length, uniqueDomains },
    source: "google-sheet",
    googleSheet: googleSheetDoc,
    originalFileName: `${args.tabTitle} · ${args.spreadsheetId.slice(0, 8)}…`,
    updatedAt: new Date(),
  };
  if (args.actor) $set.uploadedBy = args.actor.toLowerCase();

  if (existing) {
    await AccountsSheet.updateOne({ _id: existing._id }, { $set });
  } else {
    await AccountsSheet.create({
      projectId: args.projectId,
      manualDnc: [],
      ...$set,
    });
  }

  return {
    uploaded: parsed.length,
    uniqueDomains,
    skippedNoDomain,
    domainColumn: domainCol,
    companyColumn: companyCol,
    headers,
  };
}

export async function recordSyncError(projectId: string, message: string): Promise<void> {
  await AccountsSheet.updateOne(
    { projectId },
    { $set: { "googleSheet.lastSyncError": message } },
  );
}
