import { NextRequest, NextResponse } from "next/server";
import { fetchLeadIntelForAccount, isCoreSignalLive, getCoreSignalCreditsUsed, resetCoreSignalCredits, type LeadIntelAccount } from "@/lib/outbound/coresignal";

// Lead intel lookup — operator pastes account domains, we return decision-makers + their
// full LinkedIn activity (posts, shares, comments, articles) per person, so the operator
// can hand-craft per-lead emails referencing what each person actually posted about.
export const maxDuration = 300;

function cleanDomain(raw: string): string {
  return raw.toLowerCase().trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .trim();
}

export async function POST(req: NextRequest) {
  if (!isCoreSignalLive()) {
    return NextResponse.json({ error: "CORESIGNAL_API_KEY missing in .env.local" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const rawDomains: string[] = Array.isArray(body.domains) ? body.domains : (typeof body.domains === "string" ? String(body.domains).split(/[\n,]+/) : []);
  const titles: string[] | undefined = Array.isArray(body.titles) && body.titles.length > 0 ? body.titles.map(String) : undefined;
  const maxMembers: number = Number.isFinite(Number(body.maxMembers)) ? Math.max(1, Math.min(20, Number(body.maxMembers))) : 5;
  const postLimitPerMember: number = Number.isFinite(Number(body.postLimitPerMember)) ? Math.max(1, Math.min(30, Number(body.postLimitPerMember))) : 10;

  const domains = Array.from(new Set(rawDomains.map(cleanDomain).filter(Boolean))).slice(0, 25);
  if (domains.length === 0) {
    return NextResponse.json({ error: "no domains provided" }, { status: 400 });
  }

  resetCoreSignalCredits();
  const startedAt = Date.now();
  const accounts: LeadIntelAccount[] = [];

  // Process domains sequentially to keep credit usage predictable per-account.
  for (const domain of domains) {
    if (req.signal.aborted) break;
    try {
      const r = await fetchLeadIntelForAccount(domain, { titles, maxMembers, postLimitPerMember }, req.signal);
      accounts.push(r);
    } catch (e) {
      accounts.push({
        domain,
        companyId: null,
        members: [],
        errors: [e instanceof Error ? e.message : "unknown"],
        triedFilters: [],
      });
    }
  }

  const elapsedMs = Date.now() - startedAt;
  const creditsUsed = getCoreSignalCreditsUsed();
  const totalMembers = accounts.reduce((s, a) => s + a.members.length, 0);
  const totalPosts = accounts.reduce((s, a) => s + a.members.reduce((s2, m) => s2 + m.recentActivity.length, 0), 0);

  return NextResponse.json({
    accounts,
    summary: {
      domains: domains.length,
      members: totalMembers,
      posts: totalPosts,
      creditsUsed,
      elapsedMs,
    },
  });
}
