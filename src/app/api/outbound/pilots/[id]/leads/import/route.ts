import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { connectDB } from "@/lib/mongodb";
import OutboundPilot from "@/lib/models/outbound/pilot";
import OutboundLead from "@/lib/models/outbound/lead";
import OutboundAccount from "@/lib/models/outbound/account";
import { makePersonKey } from "@/lib/outbound/types";
import { buildLeadPrompt } from "@/lib/outbound/agents/phase9-prompt-build";
import type { ScoredAccount, Stakeholder, LeadResearch } from "@/lib/outbound/types";

export const maxDuration = 120;

interface PilotShape {
  clientName?: string;
  config?: { sellerName?: string };
}

function str(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  if (v == null) return "";
  return String(v).trim();
}
function num(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function arr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  const s = str(v);
  if (!s) return [];
  return s.split(/\s*[·,]\s*/).filter(Boolean);
}

function pick(row: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && row[k] !== "") return str(row[k]);
  }
  return "";
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await ctx.params;

  let formData: FormData;
  try { formData = await req.formData(); }
  catch { return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 }); }

  const actorRole = String(formData.get("actorRole") || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isTest = String(formData.get("isTest") || "") === "true";
  const overwriteAccounts = String(formData.get("overwriteAccounts") || "") === "true";
  const dataPilotId = isTest ? `${id}__test` : id;

  const file = formData.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "file field required (.xlsx or .csv)" }, { status: 400 });

  const pilot = await OutboundPilot.findById(id).lean<PilotShape>();
  if (!pilot) return NextResponse.json({ error: "pilot not found" }, { status: 404 });
  const sellerName = pilot.config?.sellerName || pilot.clientName || "VWO";

  const buf = Buffer.from(await file.arrayBuffer());
  let workbook: XLSX.WorkBook;
  try { workbook = XLSX.read(buf, { type: "buffer" }); }
  catch (e) { return NextResponse.json({ error: `failed to parse file: ${e instanceof Error ? e.message : "unknown"}` }, { status: 400 }); }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return NextResponse.json({ error: "no sheets in file" }, { status: 400 });
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  if (rows.length === 0) return NextResponse.json({ error: "no rows in file" }, { status: 400 });

  let imported = 0;
  let promptsBuilt = 0;
  const accountUpserts = new Map<string, Record<string, unknown>>();
  const skipped: { row: number; reason: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const domain = pick(r, "domain", "Domain", "accountDomain").toLowerCase();
    if (!domain) { skipped.push({ row: i + 2, reason: "missing domain" }); continue; }

    const firstName = pick(r, "first_name", "firstName", "First Name");
    const lastName = pick(r, "last_name", "lastName", "Last Name");
    const fullName = pick(r, "full_name", "fullName", "Full Name") || `${firstName} ${lastName}`.trim();
    const linkedinUrl = pick(r, "contact_linkedin_url", "contactLinkedinUrl", "LinkedIn", "linkedin_url");
    const personKey = makePersonKey({ linkedinUrl, fullName, firstName, lastName });
    if (!personKey) { skipped.push({ row: i + 2, reason: "missing person identity (need linkedin or name)" }); continue; }

    const email = pick(r, "email", "Email").toLowerCase();
    const emailStatus = pick(r, "email_status", "emailStatus") || (email ? "verified" : "unavailable");
    const contactTitle = pick(r, "contact_title", "contactTitle", "Title");
    const companyShort = pick(r, "company_short", "companyShort", "Company") || domain.split(".")[0];
    const companyFull = pick(r, "company_full", "companyFull", "Company Name") || companyShort;
    const industry = pick(r, "industry", "Industry");
    const country = pick(r, "country", "Country");
    const employees = num(pick(r, "employees", "Employees"));
    const score = num(pick(r, "score", "Score"));
    const segment = pick(r, "segment", "Segment").toLowerCase() || "active";
    const observationAngle = pick(r, "observation_angle", "observationAngle");
    const topPain = pick(r, "top_pain", "topPain");
    const valueAngle = pick(r, "value_angle", "valueAngle");
    const subjectTopic = pick(r, "subject_topic", "subjectTopic");
    const socialProofMatch = arr(pick(r, "social_proof_match", "socialProofMatch"));
    const companyLinkedinUrl = pick(r, "company_linkedin_url", "companyLinkedinUrl");

    const subject1 = pick(r, "subject_1", "subject1");
    const body1 = pick(r, "body_1", "body1");
    const subject2 = pick(r, "subject_2", "subject2");
    const body2 = pick(r, "body_2", "body2");
    const subject3 = pick(r, "subject_3", "subject3");
    const body3 = pick(r, "body_3", "body3");

    const account: ScoredAccount = {
      domain,
      name: companyShort,
      industry,
      secondaryIndustries: [],
      estimatedNumEmployees: employees,
      organizationRevenuePrinted: "",
      foundedYear: 0,
      city: "",
      state: "",
      country,
      ownedByOrganization: "",
      shortDescription: "",
      keywords: [],
      dhMarketing: 0, dhEngineering: 0, dhProductManagement: 0, dhSales: 0,
      headcount6mGrowth: 0, headcount12mGrowth: 0,
      alexaRanking: 0,
      linkedinUrl: companyLinkedinUrl,
      publiclyTradedSymbol: "",
      score,
      segment: (segment as ScoredAccount["segment"]) || "active",
      scoreBreakdown: {},
    };
    const stakeholder: Stakeholder = {
      firstName, lastName, fullName,
      title: contactTitle,
      linkedinUrl,
      seniority: "",
      pickedReason: "Imported from XLSX",
      personKey,
    };
    const research: LeadResearch = {
      observationAngle,
      secondaryObservation: "",
      signalForBody3: "",
      theirCustomers: "",
      whatTheySell: "",
      theirStage: "",
      topPain,
      valueAngle,
      socialProofMatch,
      subjectTopic,
    };
    const claudePrompt = buildLeadPrompt({ sellerName, account, stakeholder, research, email, emailStatus });
    promptsBuilt++;

    const hasUsableEmail = !!email && (emailStatus === "verified" || emailStatus === "likely_to_engage");
    const hasFullSequence = !!(body1 && body2 && body3);

    await OutboundLead.updateOne(
      { pilotId: dataPilotId, accountDomain: domain, personKey },
      {
        $set: {
          pilotId: dataPilotId, accountDomain: domain, personKey,
          companyShort, companyFull,
          industry, employees, country,
          score, segment,
          rank: i + 1,
          firstName, lastName, fullName,
          contactTitle, contactLinkedinUrl: linkedinUrl,
          contactSeniority: "",
          pickedReason: "Imported from XLSX",
          email, emailStatus: emailStatus as "verified" | "likely_to_engage" | "unavailable" | "missing",
          observationAngle,
          topPain, valueAngle,
          socialProofMatch,
          subjectTopic,
          subject1, body1, subject2, body2, subject3, body3,
          claudePrompt,
          shippable: hasFullSequence && hasUsableEmail,
          validationIssues: [],
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    imported++;

    if (!accountUpserts.has(domain)) {
      accountUpserts.set(domain, {
        pilotId: dataPilotId, domain,
        name: companyShort, industry, country,
        estimatedNumEmployees: employees,
        score, segment, rank: 0,
        linkedinUrl: companyLinkedinUrl,
        enriched: true,
      });
    }
  }

  if (overwriteAccounts || accountUpserts.size > 0) {
    const ops = Array.from(accountUpserts.values()).map((a) => ({
      updateOne: {
        filter: { pilotId: dataPilotId, domain: String(a.domain) },
        update: { $set: a },
        upsert: true,
      },
    }));
    if (ops.length > 0) {
      const CHUNK = 500;
      for (let i = 0; i < ops.length; i += CHUNK) {
        await OutboundAccount.bulkWrite(ops.slice(i, i + CHUNK), { ordered: false });
      }
    }
  }

  if (!isTest) {
    const now = new Date().toISOString();
    const phasesToMark = ["ingest", "filter", "subset", "enrich", "score", "stakeholder", "email_match", "research"];
    const synthetic = phasesToMark.map((key) => ({
      key,
      status: "complete",
      startedAt: now,
      completedAt: now,
      durationMs: 0,
      inputCount: imported,
      outputCount: imported,
      metrics: { source: "imported" },
      log: ["Synthetic completion: data populated via XLSX/CSV import."],
      error: "",
      apolloCreditsUsed: 0,
      llmTokensIn: 0,
      llmTokensOut: 0,
    }));
    const pilotDoc = await OutboundPilot.findById(id).lean<{ phases?: Array<{ key: string; status?: string }> }>();
    const existing = new Map((pilotDoc?.phases || []).map((p) => [p.key, p]));
    const allKeys = ["ingest", "filter", "subset", "enrich", "score", "stakeholder", "email_match", "research", "draft", "validate", "export"];
    const mergedPhases = allKeys.map((key) => {
      const synth = synthetic.find((p) => p.key === key);
      if (synth) return synth;
      return existing.get(key) || {
        key, status: "pending", startedAt: null, completedAt: null,
        durationMs: 0, inputCount: 0, outputCount: 0, metrics: {}, log: [], error: "",
        apolloCreditsUsed: 0, llmTokensIn: 0, llmTokensOut: 0,
      };
    });
    await OutboundPilot.findByIdAndUpdate(id, { phases: mergedPhases, updatedAt: new Date() });
  }

  return NextResponse.json({
    ok: true,
    imported,
    skipped: skipped.length,
    skippedSample: skipped.slice(0, 10),
    accountsUpserted: accountUpserts.size,
    promptsBuilt,
    bucket: isTest ? "test" : "production",
  });
}
