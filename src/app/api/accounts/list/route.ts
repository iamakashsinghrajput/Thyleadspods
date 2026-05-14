import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import Project from "@/lib/models/project";
import AccountsSheet from "@/lib/models/accounts-sheet";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";
import { normalizeDomain, rootKeyFor } from "@/lib/accounts-domain";
import { migrateLegacyGlobalSheet } from "@/lib/accounts-migrate";

async function actorRole(email: string): Promise<string> {
  const e = (email || "").toLowerCase().trim();
  if (!e) return "";
  if (e === SUPERADMIN_EMAIL) return "superadmin";
  await connectDB();
  const u = await UserModel.findOne({ email: e }).select("role").lean<{ role?: string }>();
  return u?.role || "";
}

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
  const actor = req.nextUrl.searchParams.get("actor") || "";
  const role = await actorRole(actor);
  if (role !== "superadmin" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const projectId = (req.nextUrl.searchParams.get("projectId") || "").trim();
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  await connectDB();
  const project = await Project.findOne({ id: projectId }).select("id clientName clientId").lean<{ id: string; clientName?: string; clientId?: string }>();
  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }
  await migrateLegacyGlobalSheet();

  const snapshot = await AccountsSheet.findOne({ projectId }).lean<{
    rows?: StoredRow[];
    totals?: { uploaded: number; dnc: number; net: number; uniqueDomains: number };
    manualDnc?: string[];
    manualDncUpdatedAt?: Date | null;
    manualDncUpdatedBy?: string;
    originalFileName?: string;
    uploadedBy?: string;
    updatedAt?: Date | null;
  }>();

  if (!snapshot) {
    return NextResponse.json({
      projectId,
      clientName: project.clientName || "",
      clientId: project.clientId || "",
      groups: [],
      totals: { uploaded: 0, dnc: 0, net: 0, uniqueDomains: 0, manualDnc: 0, manualDncMatched: 0 },
      manualDnc: [],
      originalFileName: "",
      uploadedBy: "",
      updatedAt: null,
    });
  }

  const allRows: StoredRow[] = snapshot.rows || [];
  const manualDnc = (snapshot.manualDnc || []).map((d) => normalizeDomain(d)).filter(Boolean);
  const manualDomainSet = new Set(manualDnc);
  const manualRootSet = new Set(manualDnc.map(rootKeyFor).filter(Boolean));

  let manualDncMatched = 0;
  const surviving: StoredRow[] = [];
  for (const r of allRows) {
    if (r.dnc) continue;
    if (manualDomainSet.has(r.domain) || manualRootSet.has(r.rootKey || rootKeyFor(r.domain))) {
      manualDncMatched++;
      continue;
    }
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

  const baseTotals = snapshot.totals || { uploaded: 0, dnc: 0, net: 0, uniqueDomains: 0 };
  const net = surviving.length;
  const uniqueDomains = groups.length;

  return NextResponse.json({
    projectId,
    clientName: project.clientName || "",
    clientId: project.clientId || "",
    groups,
    totals: {
      uploaded: baseTotals.uploaded,
      dnc: baseTotals.dnc,
      net,
      uniqueDomains,
      manualDnc: manualDnc.length,
      manualDncMatched,
    },
    manualDnc,
    manualDncUpdatedAt: snapshot.manualDncUpdatedAt?.toISOString?.() || null,
    manualDncUpdatedBy: snapshot.manualDncUpdatedBy || "",
    originalFileName: snapshot.originalFileName || "",
    uploadedBy: snapshot.uploadedBy || "",
    updatedAt: snapshot.updatedAt?.toISOString?.() || null,
  });
}
