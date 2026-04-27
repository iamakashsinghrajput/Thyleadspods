import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OnboardingClient from "@/lib/models/onboarding/client";
import OnboardingAccount from "@/lib/models/onboarding/account";
import OnboardingContact from "@/lib/models/onboarding/contact";
import { parseSheetSource, fetchSheetCsv, parseCsv } from "@/lib/onboarding/sheets";

// Body: { clientId, sheetUrl }
// Pulls CSV from a public Google Sheet, parses rows, links each contact to the
// matching account by company name, and bulk-inserts into OnboardingContact.
// Already-imported rows (matched by clientId + linkedinUrl OR email + name)
// are skipped so re-running is safe.
export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const clientId = (body.clientId || "").toString();
  const sheetUrl = (body.sheetUrl || "").toString();
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
  if (!sheetUrl) return NextResponse.json({ error: "sheetUrl required" }, { status: 400 });

  const client = await OnboardingClient.findById(clientId).lean<{ _id: { toString(): string } }>();
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });

  const src = parseSheetSource(sheetUrl);
  if (!src) {
    return NextResponse.json({
      error: "Unrecognized sheet URL or ID. Paste the full Google Sheets URL, e.g. https://docs.google.com/spreadsheets/d/<id>/edit#gid=0",
    }, { status: 400 });
  }

  let csv: string;
  try {
    csv = await fetchSheetCsv(src.id, src.gid);
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sheet fetch failed" }, { status: 400 });
  }

  const parsed = parseCsv(csv);
  if (parsed.rows.length === 0) {
    return NextResponse.json({ error: "Sheet had a header row but no data rows.", warnings: parsed.warnings, headers: parsed.headers }, { status: 400 });
  }

  // Map account companyName → accountId so contacts get linked.
  const accountRows = await OnboardingAccount.find({ clientId }).lean<{ _id: { toString(): string }; companyName: string }[]>();
  const accountByName = new Map<string, string>();
  for (const a of accountRows) {
    accountByName.set(a.companyName.toLowerCase().trim(), String(a._id));
  }

  const createdBy = (body.createdBy || "").toString().toLowerCase();
  let inserted = 0;
  let skipped = 0;
  let unmatched = 0; // contacts whose company doesn't match an account row

  for (const r of parsed.rows) {
    // Dedupe: skip if same client + LinkedIn URL OR same client + email + name already exists.
    const dupQuery: Record<string, unknown>[] = [];
    if (r.linkedinUrl) dupQuery.push({ clientId, linkedinUrl: r.linkedinUrl });
    if (r.email) dupQuery.push({ clientId, email: r.email.toLowerCase() });
    if (r.firstName && r.lastName && r.companyName) {
      dupQuery.push({ clientId, firstName: r.firstName, lastName: r.lastName, companyName: r.companyName });
    }
    if (dupQuery.length > 0) {
      const existing = await OnboardingContact.findOne({ $or: dupQuery } as Record<string, unknown>).lean();
      if (existing) { skipped++; continue; }
    }

    const accountId = r.companyName ? (accountByName.get(r.companyName.toLowerCase().trim()) || "") : "";
    if (!accountId && r.companyName) unmatched++;

    await OnboardingContact.create({
      clientId,
      accountId,
      companyName: r.companyName,
      firstName: r.firstName,
      lastName: r.lastName,
      jobTitle: r.jobTitle,
      linkedinUrl: r.linkedinUrl,
      email: r.email,
      source: "sheet",
      sheetRow: r.rowNumber,
      notes: r.notes,
      createdBy,
    });
    inserted++;
  }

  return NextResponse.json({
    ok: true,
    inserted,
    skipped,
    unmatchedCompany: unmatched,
    totalRows: parsed.rows.length,
    headers: parsed.headers,
    warnings: parsed.warnings,
  });
}
