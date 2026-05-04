import type { LeadEmail, PhaseState } from "../types";
import { withTimeout, APOLLO_FETCH_TIMEOUT_MS } from "../fetch-signal";
import type { StakeholderRow } from "./phase6-stakeholder";

export interface EmailMatchResult {
  domain: string;
  personKey: string;
  email: LeadEmail;
}

export interface EmailMatchInput {
  rows: StakeholderRow[];
  apolloCreditsBudget: number;
  existingEmails?: Map<string, LeadEmail>;
  onBatch?: (results: EmailMatchResult[]) => Promise<void>;
  shouldCancel?: () => Promise<boolean>;
  signal?: AbortSignal;
}

export interface EmailMatchOutput {
  results: EmailMatchResult[];
  creditsUsed: number;
  verifiedCount: number;
  likelyCount: number;
  unavailableCount: number;
  cacheHits: number;
}

interface ApolloPersonRich {
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  personal_email?: string;
  organization_email?: string;
  work_email?: string;
  email_status?: string;
  email_confidence?: string;
  linkedin_url?: string;
  contact_emails?: Array<{ email?: string; email_status?: string }>;
}

function extractEmail(p: ApolloPersonRich): { email: string; status: string } {
  const candidates: Array<{ email?: string; status?: string }> = [
    { email: p.email, status: p.email_status },
    ...(p.contact_emails || []).map((c) => ({ email: c.email, status: c.email_status })),
    { email: p.organization_email, status: p.email_status },
    { email: p.work_email, status: p.email_status },
    { email: p.personal_email, status: p.email_status },
  ];
  for (const c of candidates) {
    if (c.email && c.email.includes("@") && !/email_not_unlocked|locked/i.test(c.email)) {
      return { email: c.email, status: (c.status || p.email_status || "").toLowerCase() };
    }
  }
  return { email: "", status: (p.email_status || "").toLowerCase() };
}

interface ApolloMatchDetail {
  first_name?: string;
  last_name?: string;
  name?: string;
  organization_name?: string;
  domain?: string;
  linkedin_url?: string;
}

function normLinkedin(u: string): string {
  if (!u) return "";
  return u.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "").trim();
}

function attributeMatch(matched: ApolloPersonRich[], stakeholder: { fullName: string; firstName: string; lastName: string; linkedinUrl: string }, indexHint: number): ApolloPersonRich | undefined {
  if (matched.length === 0) return undefined;
  const target = normLinkedin(stakeholder.linkedinUrl);
  if (target) {
    for (const m of matched) if (normLinkedin(m.linkedin_url || "") === target) return m;
  }
  const fullLc = stakeholder.fullName.toLowerCase().trim();
  for (const m of matched) if ((m.name || "").toLowerCase().trim() === fullLc) return m;
  const fn = stakeholder.firstName.toLowerCase().trim();
  const ln = stakeholder.lastName.toLowerCase().trim();
  if (fn && ln) {
    for (const m of matched) {
      const n = (m.name || "").toLowerCase();
      if (n.includes(fn) && n.includes(ln)) return m;
      if ((m.first_name || "").toLowerCase() === fn && (m.last_name || "").toLowerCase() === ln) return m;
    }
  }
  if (matched.length === 1) return matched[0];
  if (indexHint >= 0 && indexHint < matched.length) return matched[indexHint];
  return undefined;
}

async function bulkMatchApollo(details: ApolloMatchDetail[], apiKey: string, signal?: AbortSignal): Promise<{ matched: ApolloPersonRich[]; unmatchedCount: number; creditsConsumed: number; rawShape: string }> {
  const res = await fetch("https://api.apollo.io/v1/people/bulk_match", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({
      reveal_personal_emails: true,
      reveal_phone_number: false,
      details,
    }),
    signal: withTimeout(signal, APOLLO_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`apollo bulk_match ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as Record<string, unknown>;
  const matched = (data.matches || data.matched_people || []) as ApolloPersonRich[];
  const missingArr = Array.isArray(data.missing_records) ? data.missing_records.length : 0;
  const unmatchedCount = ((data.unmatched_count ?? data.missing_records_count ?? missingArr ?? 0) as number) | 0;
  const creditsConsumed = ((data.credits_consumed ?? 0) as number) | 0;
  const sample = matched[0] || {};
  const sampleKeys = Object.keys(sample).slice(0, 12).join(",");
  const rawShape = `top-keys=[${Object.keys(data).slice(0, 10).join(",")}] matchedCount=${matched.length} unmatched=${unmatchedCount} credits=${creditsConsumed} sampleKeys=[${sampleKeys}] sampleHasEmail=${!!sample.email} sampleStatus=${sample.email_status || "—"}`;
  return { matched, unmatchedCount, creditsConsumed, rawShape };
}

function mockEmail(domain: string, fullName: string): LeadEmail {
  const seed = (domain + fullName).length;
  const r = seed % 10;
  if (r < 5) {
    const slug = fullName.toLowerCase().replace(/\s+/g, ".");
    return { email: `${slug}@${domain}`, emailStatus: "verified" };
  }
  if (r < 7) {
    const slug = fullName.split(" ")[0].toLowerCase();
    return { email: `${slug}@${domain}`, emailStatus: "likely_to_engage" };
  }
  return { email: "", emailStatus: "unavailable" };
}

export async function emailMatchAgent(input: EmailMatchInput): Promise<{ output: EmailMatchOutput; state: Pick<PhaseState, "log" | "metrics" | "inputCount" | "outputCount" | "apolloCreditsUsed"> }> {
  const apiKey = (process.env.APOLLO_API_KEY || "").trim();
  const live = !!apiKey;
  const log: string[] = [];
  log.push(live ? "Apollo live: people bulk_match enabled." : "Apollo mock: deterministic email pattern.");

  const cache = input.existingEmails || new Map<string, LeadEmail>();
  const results: EmailMatchResult[] = [];
  let creditsUsed = 0;
  let verifiedCount = 0, likelyCount = 0, unavailableCount = 0, cacheHits = 0;

  async function persist(rows: EmailMatchResult[]) {
    if (!input.onBatch || rows.length === 0) return;
    try { await input.onBatch(rows); } catch (err) {
      log.push(`Persist callback failed: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }

  const valid = input.rows.filter((r) => r.stakeholder);
  const toMatch: typeof valid = [];
  for (const r of valid) {
    const personKey = r.stakeholder!.personKey || "";
    const cacheKey = `${r.account.domain}::${personKey}`;
    const cached = cache.get(cacheKey);
    if (cached && cached.email && (cached.emailStatus === "verified" || cached.emailStatus === "likely_to_engage")) {
      results.push({ domain: r.account.domain, personKey, email: cached });
      cacheHits++;
      if (cached.emailStatus === "verified") verifiedCount++;
      else likelyCount++;
    } else {
      toMatch.push(r);
    }
  }
  if (cacheHits > 0) log.push(`Cache hits: ${cacheHits} email(s) already on file, skipping Apollo calls.`);

  if (live) {
    let firstBatchLogged = false;
    for (let i = 0; i < toMatch.length; i += 10) {
      if (input.signal?.aborted) { log.push(`Aborted at ${i}/${toMatch.length}.`); break; }
      if (input.shouldCancel && await input.shouldCancel()) { log.push("Cancelled by user during bulk_match."); break; }
      if (creditsUsed >= input.apolloCreditsBudget) {
        log.push(`Email budget reached at ${creditsUsed} credits. Stopping.`);
        const skipped: EmailMatchResult[] = toMatch.slice(i).map((r) => ({ domain: r.account.domain, personKey: r.stakeholder!.personKey || "", email: { email: "", emailStatus: "missing" as const } }));
        results.push(...skipped);
        await persist(skipped);
        break;
      }
      const slice = toMatch.slice(i, i + 10);
      const details: ApolloMatchDetail[] = slice.map((r) => {
        const s = r.stakeholder!;
        const detail: ApolloMatchDetail = {
          organization_name: r.account.name,
          domain: r.account.domain,
        };
        if (s.firstName) detail.first_name = s.firstName;
        if (s.lastName) detail.last_name = s.lastName;
        if (!s.firstName && !s.lastName && s.fullName) detail.name = s.fullName;
        if (s.linkedinUrl) detail.linkedin_url = s.linkedinUrl;
        return detail;
      });
      const batchResults: EmailMatchResult[] = [];
      try {
        const { matched, rawShape, creditsConsumed } = await bulkMatchApollo(details, apiKey, input.signal);
        if (!firstBatchLogged) {
          log.push(`Apollo response shape: ${rawShape}`);
          firstBatchLogged = true;
        }
        creditsUsed += creditsConsumed;
        let batchVerified = 0, batchLikely = 0, batchUnattributed = 0;
        for (let j = 0; j < slice.length; j++) {
          const r = slice[j];
          const personKey = r.stakeholder!.personKey || "";
          const m = attributeMatch(matched, r.stakeholder!, j);
          const extracted = m ? extractEmail(m) : { email: "", status: "" };
          if (m && extracted.email) {
            const norm: LeadEmail["emailStatus"] = extracted.status === "verified" ? "verified" : extracted.status === "likely_to_engage" ? "likely_to_engage" : "unavailable";
            batchResults.push({ domain: r.account.domain, personKey, email: { email: extracted.email, emailStatus: norm } });
            if (norm === "verified") { verifiedCount++; batchVerified++; }
            else if (norm === "likely_to_engage") { likelyCount++; batchLikely++; }
            else unavailableCount++;
          } else {
            batchResults.push({ domain: r.account.domain, personKey, email: { email: "", emailStatus: "unavailable" } });
            unavailableCount++;
            if (m && !extracted.email) batchUnattributed++;
          }
        }
        if (matched.length > 0 && batchVerified + batchLikely === 0) {
          log.push(`Batch ${Math.floor(i/10)}: Apollo returned ${matched.length} record(s) but no email field on any. Plan may not allow email reveal, or reveal_personal_emails flag is gated. Unattributed (matched person, no email): ${batchUnattributed}.`);
        }
      } catch (err) {
        log.push(`Match batch failed: ${err instanceof Error ? err.message : "unknown"}`);
        for (const r of slice) batchResults.push({ domain: r.account.domain, personKey: r.stakeholder!.personKey || "", email: { email: "", emailStatus: "missing" } });
      }
      results.push(...batchResults);
      await persist(batchResults);
    }
  } else {
    const mockResults: EmailMatchResult[] = [];
    for (const r of toMatch) {
      const e = mockEmail(r.account.domain, r.stakeholder!.fullName);
      mockResults.push({ domain: r.account.domain, personKey: r.stakeholder!.personKey || "", email: e });
      if (e.emailStatus === "verified") { verifiedCount++; creditsUsed++; }
      else if (e.emailStatus === "likely_to_engage") { likelyCount++; creditsUsed++; }
      else unavailableCount++;
    }
    results.push(...mockResults);
    await persist(mockResults);
  }

  log.push(`Verified ${verifiedCount}, likely ${likelyCount}, unavailable ${unavailableCount}. Apollo credits: ${creditsUsed}. Cache hits: ${cacheHits}.`);

  return {
    output: { results, creditsUsed, verifiedCount, likelyCount, unavailableCount, cacheHits },
    state: {
      log,
      metrics: {
        verifiedCount, likelyCount, unavailableCount, creditsUsed, cacheHits,
        verifiedRatePct: valid.length === 0 ? 0 : Math.round((verifiedCount / valid.length) * 100),
      },
      inputCount: valid.length,
      outputCount: verifiedCount + likelyCount,
      apolloCreditsUsed: creditsUsed,
    },
  };
}
