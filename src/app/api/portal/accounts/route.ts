import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import AccountsSheet from "@/lib/models/accounts-sheet";
import { normalizeDomain, rootKeyFor } from "@/lib/accounts-domain";
import { migrateLegacyGlobalSheet } from "@/lib/accounts-migrate";
import { syncFromGoogleSheet, recordSyncError } from "@/lib/accounts-sync";
import { isApiKeyConfigured } from "@/lib/google-sheets";

type StoredRow = { domain: string; company: string; dnc: boolean; rootKey: string };

type Group = {
  rootKey: string;
  displayDomain: string;
  company: string;
  domains: { domain: string; company: string }[];
};

const TLD_PRIORITY = [".com", ".io", ".co", ".org", ".net", ".ai"];

function pickDisplayDomain(domains: string[]): string {
  if (domains.length === 0) return "";
  const sorted = [...domains].sort();
  for (const tld of TLD_PRIORITY) {
    const hit = sorted.find((d) => d.endsWith(tld));
    if (hit) return hit;
  }
  return sorted[0];
}

export async function GET(req: NextRequest) {
  const projectId = (req.nextUrl.searchParams.get("projectId") || "").trim();
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  await connectDB();
  await migrateLegacyGlobalSheet();

  type GoogleSheetMeta = {
    spreadsheetId?: string;
    tabTitle?: string;
    tabSheetId?: number | null;
    sheetUrl?: string;
  };

  let snapshot = await AccountsSheet.findOne({ projectId }).lean<{
    rows?: StoredRow[];
    manualDnc?: string[];
    updatedAt?: Date | null;
    googleSheet?: GoogleSheetMeta;
  }>();

  const gs = snapshot?.googleSheet;
  if (gs?.spreadsheetId && gs.tabTitle && isApiKeyConfigured()) {
    try {
      await syncFromGoogleSheet({
        projectId,
        spreadsheetId: gs.spreadsheetId,
        tabTitle: gs.tabTitle,
        tabSheetId: gs.tabSheetId ?? null,
        sheetUrl: gs.sheetUrl,
      });
      snapshot = await AccountsSheet.findOne({ projectId }).lean<typeof snapshot>();
    } catch (e) {
      await recordSyncError(projectId, e instanceof Error ? e.message : "Sync failed");
    }
  }

  if (!snapshot) {
    return NextResponse.json({ groups: [], total: 0, updatedAt: null });
  }

  const allRows: StoredRow[] = snapshot.rows || [];
  const manualDnc = (snapshot.manualDnc || []).map((d) => normalizeDomain(d)).filter(Boolean);
  const manualDomainSet = new Set(manualDnc);
  const manualRootSet = new Set(manualDnc.map(rootKeyFor).filter(Boolean));

  const surviving: StoredRow[] = [];
  for (const r of allRows) {
    if (r.dnc) continue;
    if (manualDomainSet.has(r.domain) || manualRootSet.has(r.rootKey || rootKeyFor(r.domain))) continue;
    surviving.push(r);
  }

  const grouped = new Map<string, Group>();
  for (const r of surviving) {
    const key = r.rootKey || rootKeyFor(r.domain) || r.domain;
    const g = grouped.get(key);
    if (!g) {
      grouped.set(key, {
        rootKey: key,
        displayDomain: r.domain,
        company: r.company,
        domains: [{ domain: r.domain, company: r.company }],
      });
    } else {
      g.domains.push({ domain: r.domain, company: r.company });
      if (!g.company && r.company) g.company = r.company;
    }
  }

  const groups = Array.from(grouped.values())
    .map((g) => {
      const sortedDomains = g.domains.sort((a, b) => a.domain.localeCompare(b.domain));
      return {
        ...g,
        displayDomain: pickDisplayDomain(sortedDomains.map((d) => d.domain)),
        domains: sortedDomains,
      };
    })
    .sort((a, b) => a.displayDomain.localeCompare(b.displayDomain));

  return NextResponse.json({
    groups,
    total: groups.length,
    updatedAt: snapshot.updatedAt?.toISOString?.() || null,
  });
}
