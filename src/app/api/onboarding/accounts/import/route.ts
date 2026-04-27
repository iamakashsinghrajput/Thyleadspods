import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OnboardingClient from "@/lib/models/onboarding/client";
import OnboardingAccount from "@/lib/models/onboarding/account";

// Bulk-paste import. Body: { clientId, rows: [{ companyName, domain?, linkedinUrl?, websiteUrl? }] }
export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const clientId = (body.clientId || "").toString();
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
  const client = await OnboardingClient.findById(clientId).lean<{ status?: string }>();
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });
  const rows = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : [];
  if (rows.length === 0) return NextResponse.json({ error: "rows required" }, { status: 400 });

  const createdBy = (body.createdBy || "").toString().toLowerCase();
  let inserted = 0;
  let skipped = 0;
  for (const r of rows) {
    const companyName = typeof r.companyName === "string" ? r.companyName.trim() : "";
    if (!companyName) { skipped++; continue; }
    try {
      await OnboardingAccount.create({
        clientId,
        companyName,
        domain: typeof r.domain === "string" ? r.domain.trim().toLowerCase() : "",
        linkedinUrl: typeof r.linkedinUrl === "string" ? r.linkedinUrl.trim() : "",
        websiteUrl: typeof r.websiteUrl === "string" ? r.websiteUrl.trim() : "",
        source: "manual",
        approvalStatus: "pending",
        createdBy,
      });
      inserted++;
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 11000) skipped++;
      else throw err;
    }
  }
  if (inserted > 0 && client.status === "form_received") {
    await OnboardingClient.findByIdAndUpdate(clientId, { status: "accounts_in_progress", updatedAt: new Date() });
  }
  return NextResponse.json({ ok: true, inserted, skipped, total: rows.length });
}
