import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import OnboardingClient from "@/lib/models/onboarding/client";
import OnboardingAccount from "@/lib/models/onboarding/account";
import OnboardingForm from "@/lib/models/onboarding/form";
import { searchAccounts, isApolloLive } from "@/lib/onboarding/apollo";
import { buildApolloFiltersFromForm, type IcpFormPayload } from "@/lib/onboarding/icp";

// Allow time for the LLM ICP-extraction call (free-tier providers can be slow on cold start).
export const maxDuration = 60;

interface ClientDoc {
  _id: { toString(): string };
  status?: string;
  name?: string;
  icp?: string;
  jobTitles?: string[];
  competitors?: string[];
}

interface FormDoc {
  answers?: Record<string, unknown>;
}

// Search Apollo + (optionally) auto-create accounts on the client.
// Body: { clientId, perPage?, autoImport?, useIcp?: boolean (default true) }
//
// When useIcp is true (default) we look up the latest submitted form for the
// client, hand it to the LLM-backed buildApolloFiltersFromForm() to translate
// the free-form ICP into structured filters, then pass those into searchAccounts().
// Caller-supplied industry/geos/etc still win when explicitly provided.
export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  const actorRole = (body.actorRole || "").toLowerCase();
  if (actorRole !== "superadmin" && actorRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const clientId = (body.clientId || "").toString();
  if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
  const client = await OnboardingClient.findById(clientId).lean<ClientDoc>();
  if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 });

  const useIcp = body.useIcp !== false;

  // Resolve filters: start from the form (if useIcp), then apply explicit overrides from the request body.
  let resolvedFilter: Awaited<ReturnType<typeof buildApolloFiltersFromForm>> | null = null;
  if (useIcp) {
    const form = await OnboardingForm.findOne({ clientId, status: "submitted" })
      .sort({ submittedAt: -1 })
      .lean<FormDoc>();
    const ans = (form?.answers || {}) as Record<string, unknown>;
    const payload: IcpFormPayload = {
      companyName: client.name || "",
      companyOneLine: typeof ans.companyOneLine === "string" ? ans.companyOneLine : "",
      icp: typeof ans.icp === "string" ? ans.icp : (client.icp || ""),
      jobTitles: Array.isArray(ans.jobTitles) ? (ans.jobTitles as string[]) : (client.jobTitles || []),
      competitors: Array.isArray(ans.competitors) ? (ans.competitors as string[]) : (client.competitors || []),
      existingCustomers: Array.isArray(ans.existingCustomers) ? (ans.existingCustomers as string[]) : [],
      targetGeos: Array.isArray(ans.targetGeos) ? (ans.targetGeos as string[]) : [],
      volumeForecast: typeof ans.volumeForecast === "number" ? ans.volumeForecast : 0,
    };
    resolvedFilter = await buildApolloFiltersFromForm(payload, typeof body.perPage === "number" ? body.perPage : 25);
  }

  const searchInput = {
    industry: Array.isArray(body.industry) ? body.industry : resolvedFilter?.industry,
    jobTitles: Array.isArray(body.jobTitles) ? body.jobTitles : undefined,
    geos: Array.isArray(body.geos) ? body.geos : resolvedFilter?.geos,
    employeeCountMin: typeof body.employeeCountMin === "number" ? body.employeeCountMin : resolvedFilter?.employeeCountMin,
    employeeCountMax: typeof body.employeeCountMax === "number" ? body.employeeCountMax : resolvedFilter?.employeeCountMax,
    perPage: typeof body.perPage === "number" ? body.perPage : 25,
  };

  let results;
  try {
    results = await searchAccounts(searchInput);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "apollo search failed";
    return NextResponse.json({ error: msg, isLive: isApolloLive(), filters: resolvedFilter }, { status: 502 });
  }

  if (!body.autoImport) {
    return NextResponse.json({ ok: true, isLive: isApolloLive(), results, filters: resolvedFilter });
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
  return NextResponse.json({
    ok: true,
    isLive: isApolloLive(),
    inserted,
    skipped,
    totalFound: results.length,
    filters: resolvedFilter,
  });
}
