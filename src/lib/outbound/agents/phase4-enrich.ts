import type { EnrichedAccount, PhaseState } from "../types";
import { withTimeout, APOLLO_FETCH_TIMEOUT_MS } from "../fetch-signal";

export interface EnrichInput {
  batches: string[][];
  apolloCreditsBudget: number;
  existingAccounts?: Map<string, EnrichedAccount>;
  onBatch?: (rows: EnrichedAccount[], source: "cache" | "apollo-search" | "apollo-enrich") => Promise<void>;
  bulkEnrichTopN?: number;
  useFreeSearchFirst?: boolean;
  shouldCancel?: () => Promise<boolean>;
  signal?: AbortSignal;
}

export interface EnrichOutput {
  enriched: EnrichedAccount[];
  unmatched: string[];
  creditsUsed: number;
  cacheHits: number;
  searchHits: number;
  fullEnrichHits: number;
}

interface ApolloDeptHeadcount {
  marketing?: number;
  engineering?: number;
  product_management?: number;
  sales?: number;
}

interface ApolloOrgFull {
  name?: string;
  primary_domain?: string;
  industry?: string;
  secondary_industries?: string[];
  estimated_num_employees?: number;
  organization_revenue?: number;
  organization_revenue_printed?: string;
  founded_year?: number;
  city?: string;
  state?: string;
  country?: string;
  owned_by_organization?: { name?: string };
  short_description?: string;
  keywords?: string[];
  departmental_head_count?: ApolloDeptHeadcount;
  organization_headcount_six_month_growth?: number;
  organization_headcount_twelve_month_growth?: number;
  alexa_ranking?: number;
  linkedin_url?: string;
  publicly_traded_symbol?: string;
}

function parseOrg(o: ApolloOrgFull, fallbackDomain: string): EnrichedAccount {
  const dh = o.departmental_head_count || {};
  return {
    domain: o.primary_domain || fallbackDomain,
    name: o.name || "",
    industry: o.industry || "",
    secondaryIndustries: o.secondary_industries || [],
    estimatedNumEmployees: o.estimated_num_employees || 0,
    organizationRevenuePrinted: o.organization_revenue_printed || "",
    foundedYear: o.founded_year || 0,
    city: o.city || "",
    state: o.state || "",
    country: o.country || "",
    ownedByOrganization: o.owned_by_organization?.name || "",
    shortDescription: o.short_description || "",
    keywords: (o.keywords || []).slice(0, 30),
    dhMarketing: dh.marketing || 0,
    dhEngineering: dh.engineering || 0,
    dhProductManagement: dh.product_management || 0,
    dhSales: dh.sales || 0,
    headcount6mGrowth: o.organization_headcount_six_month_growth || 0,
    headcount12mGrowth: o.organization_headcount_twelve_month_growth || 0,
    alexaRanking: o.alexa_ranking || 0,
    linkedinUrl: o.linkedin_url || "",
    publiclyTradedSymbol: o.publicly_traded_symbol || "",
  };
}

async function searchCompaniesByDomains(domains: string[], apiKey: string, signal?: AbortSignal): Promise<EnrichedAccount[]> {
  const res = await fetch("https://api.apollo.io/v1/mixed_companies/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({
      q_organization_domains_list: domains,
      page: 1,
      per_page: Math.min(100, Math.max(domains.length, 10)),
    }),
    signal: withTimeout(signal, APOLLO_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`apollo search ${res.status}`);
  const data = (await res.json()) as { organizations?: ApolloOrgFull[]; accounts?: ApolloOrgFull[] };
  const orgs = data.organizations || data.accounts || [];
  const rows: EnrichedAccount[] = [];
  for (const o of orgs) {
    if (!o || !o.name) continue;
    const dom = (o.primary_domain || "").toLowerCase().trim();
    if (!dom) continue;
    rows.push(parseOrg(o, dom));
  }
  return rows;
}

async function bulkEnrichApollo(domains: string[], apiKey: string, signal?: AbortSignal): Promise<{ rows: EnrichedAccount[]; matchedCount: number }> {
  const res = await fetch("https://api.apollo.io/v1/organizations/bulk_enrich", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    },
    body: JSON.stringify({ domains }),
    signal: withTimeout(signal, APOLLO_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`apollo bulk_enrich ${res.status}`);
  const data = (await res.json()) as { organizations?: ApolloOrgFull[] };
  const orgs = data.organizations || [];
  const rows: EnrichedAccount[] = [];
  for (let i = 0; i < orgs.length; i++) {
    const o = orgs[i];
    if (!o || !o.name) continue;
    rows.push(parseOrg(o, domains[i]));
  }
  return { rows, matchedCount: rows.length };
}

function mockEnrich(domain: string): EnrichedAccount | null {
  const root = domain.split(".")[0];
  if (root.length < 3) return null;
  const tld = domain.split(".").pop() || "com";
  const country = tld.endsWith("in") ? "India" : "United States";

  const ROTATIONS = ["retail", "fintech", "edtech", "saas", "ecommerce", "wellness", "apparel", "logistics"];
  const idx = Math.abs(hash(domain)) % ROTATIONS.length;
  const industry = ROTATIONS[idx];
  const employees = 60 + (Math.abs(hash(domain + "emp")) % 1500);
  const founded = 2008 + (Math.abs(hash(domain + "f")) % 16);
  const alexa = 20000 + (Math.abs(hash(domain + "a")) % 480000);
  const h6 = (Math.abs(hash(domain + "h6")) % 30) / 100;

  const KEYWORD_POOLS: Record<string, string[]> = {
    retail: ["d2c", "ecommerce", "consumer goods"],
    fintech: ["fintech", "lending", "kyc", "payments"],
    edtech: ["edtech", "online learning", "exam prep"],
    saas: ["b2b saas", "platform", "api"],
    ecommerce: ["ecommerce", "marketplace", "d2c"],
    wellness: ["wellness", "beauty", "subscription"],
    apparel: ["apparel", "fashion", "d2c"],
    logistics: ["logistics", "supply chain", "saas"],
  };

  return {
    domain,
    name: root.charAt(0).toUpperCase() + root.slice(1),
    industry,
    secondaryIndustries: [],
    estimatedNumEmployees: employees,
    organizationRevenuePrinted: employees > 200 ? `${employees * 50}K` : "",
    foundedYear: founded,
    city: "Mumbai",
    state: "Maharashtra",
    country,
    ownedByOrganization: "",
    shortDescription: `${root} is an Indian ${industry} company.`,
    keywords: KEYWORD_POOLS[industry] || [],
    dhMarketing: 4 + (Math.abs(hash(domain + "m")) % 8),
    dhEngineering: 8 + (Math.abs(hash(domain + "e")) % 25),
    dhProductManagement: 2 + (Math.abs(hash(domain + "p")) % 6),
    dhSales: 5 + (Math.abs(hash(domain + "s")) % 12),
    headcount6mGrowth: h6,
    headcount12mGrowth: h6 * 2,
    alexaRanking: alexa,
    linkedinUrl: `https://linkedin.com/company/${root}`,
    publiclyTradedSymbol: "",
  };
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

function partialQualitySignal(r: EnrichedAccount): number {
  let s = 0;
  const a = r.alexaRanking;
  if (a > 0 && a < 50000) s += 30;
  else if (a > 0 && a < 150000) s += 20;
  else if (a > 0 && a < 500000) s += 10;
  else if (a > 0) s += 4;
  if (r.foundedYear > 0) {
    const age = new Date().getFullYear() - r.foundedYear;
    if (age >= 4 && age <= 15) s += 10;
    else if (age >= 16 && age <= 25) s += 5;
  }
  if (r.linkedinUrl) s += 5;
  return s;
}

export async function enrichAgent(input: EnrichInput): Promise<{ output: EnrichOutput; state: Pick<PhaseState, "log" | "metrics" | "inputCount" | "outputCount" | "apolloCreditsUsed"> }> {
  const apiKey = (process.env.APOLLO_API_KEY || "").trim();
  const live = !!apiKey;
  const useFreeSearch = input.useFreeSearchFirst !== false;
  const bulkEnrichTopN = input.bulkEnrichTopN ?? Number.MAX_SAFE_INTEGER;
  const log: string[] = [];
  log.push(live
    ? bulkEnrichTopN === 0
      ? "Apollo live. Strategy: FREE search only (mixed_companies/search). No credits spent in Phase 4 — credits reserved for Phase 7 email_match."
      : `Apollo live. Strategy: ${useFreeSearch ? "free search → top-" + bulkEnrichTopN + " bulk_enrich" : "bulk_enrich only"}.`
    : "Apollo mock: APOLLO_API_KEY not set, returning deterministic mock data.");

  const cache = input.existingAccounts || new Map<string, EnrichedAccount>();
  const allByDomain = new Map<string, EnrichedAccount>();
  const enriched: EnrichedAccount[] = [];
  const unmatched: string[] = [];
  let creditsUsed = 0;
  let cacheHits = 0;
  let searchHits = 0;
  let fullEnrichHits = 0;

  let totalDomains = 0;
  for (const b of input.batches) totalDomains += b.length;

  const flatDomains: string[] = [];
  for (const b of input.batches) for (const d of b) flatDomains.push(d.toLowerCase().trim());

  const cachedDomains: string[] = [];
  const toProcess: string[] = [];
  for (const d of flatDomains) {
    const hit = cache.get(d);
    if (hit && hit.industry) {
      cachedDomains.push(d);
      allByDomain.set(d, hit);
      cacheHits++;
    } else if (hit && (hit.alexaRanking > 0 || hit.linkedinUrl)) {
      allByDomain.set(d, hit);
      toProcess.push(d);
    } else {
      toProcess.push(d);
    }
  }

  if (cachedDomains.length > 0) {
    const cachedRows = cachedDomains.map((d) => allByDomain.get(d)!).filter(Boolean);
    if (input.onBatch) { try { await input.onBatch(cachedRows, "cache"); } catch {} }
    log.push(`Cache hits: ${cacheHits} fully-enriched account(s) loaded from prior runs.`);
  }

  if (!live) {
    const mockRows: EnrichedAccount[] = [];
    for (const d of toProcess) {
      const m = mockEnrich(d);
      if (m) { mockRows.push(m); allByDomain.set(d, m); creditsUsed++; fullEnrichHits++; }
      else unmatched.push(d);
    }
    if (mockRows.length > 0 && input.onBatch) {
      try { await input.onBatch(mockRows, "apollo-enrich"); } catch {}
    }
  } else if (useFreeSearch && toProcess.length > 0) {
    log.push(`Tier 1 (free search): ${toProcess.length} domain(s) in batches of 100…`);
    const SEARCH_BATCH = 100;
    for (let i = 0; i < toProcess.length; i += SEARCH_BATCH) {
      if (input.shouldCancel && await input.shouldCancel()) { log.push("Cancelled by user during search."); break; }
      const slice = toProcess.slice(i, i + SEARCH_BATCH);
      try {
        const rows = await searchCompaniesByDomains(slice, apiKey, input.signal);
        for (const r of rows) {
          const dom = r.domain.toLowerCase().trim();
          if (!dom) continue;
          const existing = allByDomain.get(dom);
          allByDomain.set(dom, existing ? { ...existing, ...r } : r);
        }
        searchHits += rows.length;
        if (rows.length > 0 && input.onBatch) {
          try { await input.onBatch(rows, "apollo-search"); } catch {}
        }
      } catch (err) {
        log.push(`Search batch ${Math.floor(i / SEARCH_BATCH)} failed: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }
    log.push(`Tier 1 done: ${searchHits} domain(s) returned by free search.`);

    const ranked = Array.from(allByDomain.entries())
      .filter(([d]) => !cachedDomains.includes(d))
      .map(([d, r]) => ({ d, r, sig: partialQualitySignal(r) }))
      .sort((a, b) => b.sig - a.sig);
    const targetTopN = Math.min(bulkEnrichTopN, ranked.length, input.apolloCreditsBudget);
    const toFullEnrich = ranked.slice(0, targetTopN).map((x) => x.d);

    if (toFullEnrich.length > 0) {
      log.push(`Tier 2 (paid bulk_enrich): top ${toFullEnrich.length} by partial signal, in batches of 10…`);
      const ENRICH_BATCH = 10;
      for (let i = 0; i < toFullEnrich.length; i += ENRICH_BATCH) {
        if (input.shouldCancel && await input.shouldCancel()) { log.push("Cancelled by user during bulk_enrich."); break; }
        if (creditsUsed >= input.apolloCreditsBudget) {
          log.push(`Budget reached at ${creditsUsed} credits. Stopping bulk_enrich.`);
          break;
        }
        const slice = toFullEnrich.slice(i, i + ENRICH_BATCH);
        try {
          const { rows, matchedCount } = await bulkEnrichApollo(slice, apiKey, input.signal);
          creditsUsed += matchedCount;
          fullEnrichHits += matchedCount;
          for (const r of rows) {
            const dom = r.domain.toLowerCase().trim();
            if (dom) allByDomain.set(dom, r);
          }
          if (rows.length > 0 && input.onBatch) {
            try { await input.onBatch(rows, "apollo-enrich"); } catch (err) {
              log.push(`Persist callback failed: ${err instanceof Error ? err.message : "unknown"}`);
            }
          }
        } catch (err) {
          log.push(`Enrich batch failed: ${err instanceof Error ? err.message : "unknown"}`);
        }
      }
    }

    for (const d of toProcess) {
      if (!allByDomain.has(d)) unmatched.push(d);
    }
  } else {
    log.push(`bulk_enrich only mode: ${toProcess.length} domain(s) in batches of 10…`);
    const ENRICH_BATCH = 10;
    for (let i = 0; i < toProcess.length; i += ENRICH_BATCH) {
      if (creditsUsed >= input.apolloCreditsBudget) {
        log.push(`Budget reached at ${creditsUsed} credits. Stopping.`);
        for (const d of toProcess.slice(i)) unmatched.push(d);
        break;
      }
      const slice = toProcess.slice(i, i + ENRICH_BATCH);
      try {
        const { rows, matchedCount } = await bulkEnrichApollo(slice, apiKey, input.signal);
        creditsUsed += matchedCount;
        fullEnrichHits += matchedCount;
        const matchedDomains = new Set(rows.map((r) => r.domain));
        for (const d of slice) if (!matchedDomains.has(d)) unmatched.push(d);
        for (const r of rows) {
          const dom = r.domain.toLowerCase().trim();
          if (dom) allByDomain.set(dom, r);
        }
        if (rows.length > 0 && input.onBatch) {
          try { await input.onBatch(rows, "apollo-enrich"); } catch {}
        }
      } catch (err) {
        log.push(`Batch failed: ${err instanceof Error ? err.message : "unknown"}`);
        for (const d of slice) unmatched.push(d);
      }
    }
  }

  for (const r of allByDomain.values()) enriched.push(r);

  const seen = new Set<string>();
  const deduped: EnrichedAccount[] = [];
  let dropped = 0;
  for (const row of enriched) {
    const key = (row.domain || "").toLowerCase().trim();
    if (!key) { dropped++; continue; }
    if (seen.has(key)) { dropped++; continue; }
    seen.add(key);
    deduped.push({ ...row, domain: key });
  }
  if (dropped > 0) log.push(`Dropped ${dropped} duplicate primary_domain row(s) from Apollo response.`);

  const matchRatePct = totalDomains === 0 ? 0 : Math.round((deduped.length / totalDomains) * 100);
  log.push(`Total accounts: ${deduped.length}/${totalDomains} (${matchRatePct}% coverage). Cache: ${cacheHits} · search: ${searchHits} · enrich: ${fullEnrichHits} · credits: ${creditsUsed}.`);

  return {
    output: { enriched: deduped, unmatched, creditsUsed, cacheHits, searchHits, fullEnrichHits },
    state: {
      log,
      metrics: { enriched: deduped.length, unmatched: unmatched.length, matchRatePct, creditsUsed, cacheHits, searchHits, fullEnrichHits, dedupedDropped: dropped, live: live ? 1 : 0 },
      inputCount: totalDomains,
      outputCount: deduped.length,
      apolloCreditsUsed: creditsUsed,
    },
  };
}
