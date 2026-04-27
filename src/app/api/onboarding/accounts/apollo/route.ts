import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OnboardingClient from "@/lib/models/onboarding/client";
import OnboardingAccount from "@/lib/models/onboarding/account";
import { searchAccounts, isApolloLive } from "@/lib/onboarding/apollo";

// Search Apollo + (optionally) auto-create accounts on the client.
// Body: { clientId, industry?, jobTitles?, geos?, employeeCountMin?, employeeCountMax?, perPage?, autoImport?: boolean }
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

  const results = await searchAccounts({
    industry: Array.isArray(body.industry) ? body.industry : undefined,
    jobTitles: Array.isArray(body.jobTitles) ? body.jobTitles : undefined,
    geos: Array.isArray(body.geos) ? body.geos : undefined,
    employeeCountMin: typeof body.employeeCountMin === "number" ? body.employeeCountMin : undefined,
    employeeCountMax: typeof body.employeeCountMax === "number" ? body.employeeCountMax : undefined,
    perPage: typeof body.perPage === "number" ? body.perPage : 25,
  });

  if (!body.autoImport) {
    return NextResponse.json({ ok: true, isLive: isApolloLive(), results });
  }

  let inserted = 0;
  let skipped = 0;
  for (const r of results) {
    try {
      await OnboardingAccount.create({
        clientId,
        companyName: r.companyName,
        domain: r.domain,
        websiteUrl: r.websiteUrl,
        linkedinUrl: r.linkedinUrl,
        industry: r.industry,
        employeeCount: r.employeeCount,
        source: r.source,
        approvalStatus: "pending",
        createdBy: (body.createdBy || "").toString().toLowerCase(),
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
  return NextResponse.json({ ok: true, isLive: isApolloLive(), inserted, skipped, totalFound: results.length });
}
