import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import Project from "@/lib/models/project";
import AccountsSheet from "@/lib/models/accounts-sheet";
import { SUPERADMIN_EMAIL } from "@/lib/user-approval";
import { normalizeDomain, rootKeyFor } from "@/lib/accounts-domain";
import { migrateLegacyGlobalSheet } from "@/lib/accounts-migrate";

export const maxDuration = 120;

async function actorRole(email: string): Promise<string> {
  const e = (email || "").toLowerCase().trim();
  if (!e) return "";
  if (e === SUPERADMIN_EMAIL) return "superadmin";
  await connectDB();
  const u = await UserModel.findOne({ email: e }).select("role").lean<{ role?: string }>();
  return u?.role || "";
}

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

export async function POST(req: NextRequest) {
  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 }); }

  const actor = String(formData.get("actor") || "");
  const role = await actorRole(actor);
  if (role !== "superadmin" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projectId = String(formData.get("projectId") || "").trim();
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  await connectDB();
  const project = await Project.findOne({ id: projectId }).select("id clientName").lean<{ id: string; clientName?: string }>();
  if (!project) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const file = formData.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "file field required (.xlsx or .csv)" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  let workbook: XLSX.WorkBook;
  try { workbook = XLSX.read(buf, { type: "buffer" }); }
  catch (e) {
    return NextResponse.json({ error: `failed to parse file: ${e instanceof Error ? e.message : "unknown"}` }, { status: 400 });
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return NextResponse.json({ error: "no sheets in file" }, { status: 400 });
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (rawRows.length === 0) {
    return NextResponse.json({ error: "no rows in file" }, { status: 400 });
  }

  const headers = Object.keys(rawRows[0] || {});
  const domainCol = detectColumn(headers, DOMAIN_NEEDLES);
  if (!domainCol) {
    return NextResponse.json(
      {
        error: "Could not find a Domain column in the sheet.",
        detectedHeaders: headers,
        hint: "Rename one of your columns to 'Domain' (or include words like website/url/site).",
      },
      { status: 400 },
    );
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

  await migrateLegacyGlobalSheet();
  await AccountsSheet.updateOne(
    { projectId },
    {
      $set: {
        projectId,
        rows: parsed,
        totals: {
          uploaded: parsed.length,
          dnc: 0,
          net: parsed.length,
          uniqueDomains,
        },
        originalFileName: (file as File).name || "accounts.xlsx",
        uploadedBy: actor.toLowerCase(),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  );

  return NextResponse.json({
    ok: true,
    uploaded: parsed.length,
    uniqueDomains,
    skippedNoDomain,
    projectId,
    clientName: project.clientName || "",
    detected: {
      domain: domainCol,
      company: companyCol,
      allHeaders: headers,
    },
  });
}
