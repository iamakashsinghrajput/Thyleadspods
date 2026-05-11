const BASE_OVERRIDE = (process.env.CORESIGNAL_BASE_URL || "").replace(/\/+$/, "");

// CoreSignal endpoint config.
// MEMBER tier: multi-source primary (returns LinkedIn posts/shares/activities, recent_activity, full experience+education).
// Falls back to employee_base only if multi_source returns 401/403/404 (subscription tier limitation).
// Per-account spend at multi_source: 1 credit (company enrich) + N credits per member collected.
const COMPANY_PATHS = [
  "/cdapi/v2/company_base",
];
const MEMBER_PATHS = [
  "/cdapi/v2/employee_multi_source",
  "/cdapi/v2/employee_base",
];
const JOB_PATHS: string[] = []; // intentionally empty — jobs API is disabled to save credits.

type SearchMode = "filter" | "es_dsl";
const resolvedSearchMode = new Map<string, SearchMode>();

function buildSearchBody(mode: SearchMode, fields: Record<string, unknown>): Record<string, unknown> {
  if (mode === "filter") return fields;
  const must = Object.entries(fields).map(([k, v]) => ({ match: { [k]: v } }));
  return { query: { bool: { must } } };
}

let resolvedCompanyBase: string | null = null;
let resolvedMemberBase: string | null = null;
let resolvedJobBase: string | null = null;

function rootBase(): string {
  if (BASE_OVERRIDE) {
    return BASE_OVERRIDE.replace(/\/cdapi\/v[12].*$/, "");
  }
  return "https://api.coresignal.com";
}

export function isCoreSignalLive(): boolean {
  return !!(process.env.CORESIGNAL_API_KEY || "").trim();
}

// Default budget upgraded to support per-lead multi_source lookups: 1 credit per company-enrich
// + 1 credit per member-collect. For a 25-lead × 3-account run that's ~28 credits at peak.
// Operator can override via CORESIGNAL_CREDITS_BUDGET in .env.local.
const DEFAULT_CREDIT_BUDGET = 50;
let creditsUsed = 0;
function getCreditBudget(): number {
  const raw = (process.env.CORESIGNAL_CREDITS_BUDGET || "").trim();
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return DEFAULT_CREDIT_BUDGET;
}
export function getCoreSignalCreditsUsed(): number { return creditsUsed; }
export function resetCoreSignalCredits(): void { creditsUsed = 0; }
export function coreSignalCreditsRemaining(): number {
  return Math.max(0, getCreditBudget() - creditsUsed);
}

interface CompanyHit {
  id: number | string;
  website?: string;
  name?: string;
  industry?: string;
  size?: string;
  founded?: number | string;
  hq_country?: string;
  hq_city?: string;
  short_description?: string;
  employees_count?: number;
  headcount_growth_6m?: number;
  headcount_growth_12m?: number;
  funding_total_usd?: number;
  last_funding_round?: { type?: string; announced_date?: string; amount_usd?: number };
  technologies?: string[];
  active_job_postings_count?: number;
  recent_executive_changes?: Array<{ name?: string; title?: string; change?: string; date?: string }>;
  raw?: Record<string, unknown>;
}

interface JobPosting {
  title?: string;
  posted_date?: string;
  location?: string;
  function?: string;
  seniority?: string;
}

export interface CoreSignalSnapshot {
  domain: string;
  company: CompanyHit | null;
  recentJobs: JobPosting[];
  members: MemberHit[];
  fetchedAt: string;
  errors: string[];
}

export interface MemberHit {
  id: string | number;
  fullName?: string;
  title?: string;
  location?: string;
  startedCurrentRoleAt?: string;
  monthsInCurrentRole?: number;
  skills?: string[];
  recentActivity?: Array<{ kind: "post" | "share" | "comment"; text?: string; postedAt?: string; engagement?: number }>;
  linkedinUrl?: string;
  previousCompanies?: Array<{ company?: string; title?: string; from?: string; to?: string }>;
  educationSummary?: string;
}

let resolvedAuthHeader: Record<string, string> | null = null;

function authVariants(apiKey: string): Array<Record<string, string>> {
  return [
    { "apikey": apiKey },
    { "Authorization": `Bearer ${apiKey}` },
    { "X-API-KEY": apiKey },
    { "Authorization": apiKey },
  ];
}

async function fetchWithAuthFallback(url: string, init: RequestInit, apiKey: string, signal: AbortSignal | undefined): Promise<Response> {
  const { withTimeout } = await import("./fetch-signal");
  const baseHeaders = { ...(init.headers as Record<string, string> | undefined) };
  if (resolvedAuthHeader) {
    const res = await fetch(url, { ...init, headers: { ...baseHeaders, ...resolvedAuthHeader }, signal: withTimeout(signal, 15000) });
    if (res.status !== 401 && res.status !== 403) return res;
  }
  let lastRes: Response | null = null;
  for (const auth of authVariants(apiKey)) {
    const res = await fetch(url, { ...init, headers: { ...baseHeaders, ...auth }, signal: withTimeout(signal, 15000) });
    if (res.status === 200 || res.status === 201) {
      resolvedAuthHeader = auth;
      return res;
    }
    if (res.status !== 401 && res.status !== 403 && res.status !== 404) return res;
    lastRes = res;
  }
  return lastRes!;
}

async function postUrl<T>(url: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const apiKey = (process.env.CORESIGNAL_API_KEY || "").trim();
  if (!apiKey) throw new Error("CORESIGNAL_API_KEY missing");
  const res = await fetchWithAuthFallback(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, apiKey, signal);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const err = new Error(`coresignal ${url} ${res.status}: ${txt.slice(0, 800)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

async function getUrl<T>(url: string, signal?: AbortSignal): Promise<T> {
  const apiKey = (process.env.CORESIGNAL_API_KEY || "").trim();
  if (!apiKey) throw new Error("CORESIGNAL_API_KEY missing");
  const res = await fetchWithAuthFallback(url, { method: "GET" }, apiKey, signal);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const err = new Error(`coresignal ${url} ${res.status}: ${txt.slice(0, 800)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

function searchEndpoint(base: string): { url: string; body: (fields: Record<string, unknown>) => Record<string, unknown> } {
  const mode = resolvedSearchMode.get(base) || "filter";
  return {
    url: `${base}/search/${mode}`,
    body: (fields) => buildSearchBody(mode, fields),
  };
}

async function resolveCompanyBase(signal?: AbortSignal): Promise<string | null> {
  if (resolvedCompanyBase) return resolvedCompanyBase;
  const root = rootBase();
  for (const p of COMPANY_PATHS) {
    const base = `${root}${p}`;
    for (const mode of ["filter", "es_dsl"] as const) {
      const url = `${base}/search/${mode}`;
      const body = buildSearchBody(mode, { website: "google.com" });
      try {
        await postUrl<unknown>(url, body, signal);
        resolvedCompanyBase = base;
        resolvedSearchMode.set(base, mode);
        return resolvedCompanyBase;
      } catch (e) {
        const status = (e as { status?: number }).status;
        if (status === 401 || status === 403) {
          resolvedCompanyBase = base;
          resolvedSearchMode.set(base, mode);
          return resolvedCompanyBase;
        }
        if (status === 400) {
          resolvedCompanyBase = base;
          resolvedSearchMode.set(base, mode);
          return resolvedCompanyBase;
        }
        continue;
      }
    }
  }
  return null;
}

async function resolveMemberBase(signal?: AbortSignal): Promise<string | null> {
  if (resolvedMemberBase) return resolvedMemberBase;
  const root = rootBase();
  // Try each member path in order — first one that responds without 401/403/404 wins.
  // multi_source preferred (richer data), employee_base fallback for tier-limited accounts.
  for (const path of MEMBER_PATHS) {
    const base = `${root}${path}`;
    for (const mode of ["filter", "es_dsl"] as const) {
      const url = `${base}/search/${mode}`;
      const body = buildSearchBody(mode, { full_name: "test" });
      try {
        await postUrl<unknown>(url, body, signal);
        resolvedMemberBase = base;
        resolvedSearchMode.set(base, mode);
        return resolvedMemberBase;
      } catch (e) {
        const status = (e as { status?: number }).status;
        if (status === 400) {
          // 400 means schema disagreement but endpoint exists → endpoint is reachable.
          resolvedMemberBase = base;
          resolvedSearchMode.set(base, mode);
          return resolvedMemberBase;
        }
        if (status === 401 || status === 403 || status === 404) {
          // Tier doesn't include this dataset — try next path.
          break;
        }
        continue;
      }
    }
  }
  return null;
}

async function resolveJobBase(_signal?: AbortSignal): Promise<string | null> {
  // Jobs API is disabled in the cost-minimised config — always returns null so callers no-op.
  return null;
}

function normaliseDomainRoot(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
    .replace(/\?.*$/, "")
    .trim();
}

export interface CompanyResolution {
  id: string | number | null;
  candidatesChecked: number;
  candidatesTotal: number;
  rejected: Array<{ id: string | number; website?: string; name?: string }>;
}

// Verified company-id resolver: CoreSignal's `website` search does fuzzy matching, so
// "libas.in" returns IDs for "libaas.com", "libasify.com", etc. To prevent picking a wrong
// company, we collect every candidate from the fuzzy search, then fetch each candidate's
// `company_base/collect/{id}` and only accept the one whose `website` field matches the
// target domain root EXACTLY. If no candidate matches, returns null (caller can decide
// whether to fall back to a name-based search or skip the account).
//
// Cost: 1 credit per candidate verified (capped at 5). The first exact match short-circuits.
export async function findCompanyIdVerified(domain: string, signal?: AbortSignal): Promise<CompanyResolution> {
  const result: CompanyResolution = { id: null, candidatesChecked: 0, candidatesTotal: 0, rejected: [] };
  const base = await resolveCompanyBase(signal);
  if (!base) return result;

  const targetRoot = normaliseDomainRoot(domain);
  if (!targetRoot) return result;

  const ep = searchEndpoint(base);

  // Collect candidates from multiple URL-variant searches.
  const allIds = new Set<string | number>();
  const variants = [targetRoot, `www.${targetRoot}`, `https://${targetRoot}`, `https://www.${targetRoot}`];
  for (const v of variants) {
    try {
      const ids = await postUrl<Array<string | number>>(ep.url, ep.body({ website: v }), signal);
      if (Array.isArray(ids)) for (const id of ids) allIds.add(id);
    } catch {}
  }

  result.candidatesTotal = allIds.size;
  if (allIds.size === 0) return result;

  // Verify each candidate by fetching and comparing the website field.
  // Cap at 5 to bound credit cost; first exact match wins and short-circuits.
  const candidates = Array.from(allIds).slice(0, 5);
  for (const id of candidates) {
    result.candidatesChecked++;
    const company = await fetchCompany(id, signal);
    if (!company) continue;
    const wsRoot = normaliseDomainRoot(company.website || "");
    if (wsRoot === targetRoot) {
      result.id = id;
      return result;
    }
    result.rejected.push({ id, website: company.website, name: company.name });
  }

  return result;
}

// Backward-compatible wrapper — used by the rest of the pipeline (Phase 8 research).
async function findCompanyId(domain: string, signal?: AbortSignal): Promise<string | number | null> {
  const r = await findCompanyIdVerified(domain, signal);
  if (!r.id && r.rejected.length > 0) {
    console.warn(`[coresignal] no exact website match for ${domain} — rejected candidates: ${r.rejected.map((x) => `${x.name || "?"} (${x.website || "?"})`).join(", ")}`);
  }
  return r.id;
}

async function fetchCompany(id: string | number, signal?: AbortSignal): Promise<CompanyHit | null> {
  const base = resolvedCompanyBase || await resolveCompanyBase(signal);
  if (!base) return null;
  try {
    const raw = await getUrl<Record<string, unknown>>(`${base}/collect/${encodeURIComponent(String(id))}`, signal);
    return mapCompany(raw);
  } catch {
    return null;
  }
}

function num(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}
function str(v: unknown): string | undefined {
  if (typeof v === "string" && v.trim()) return v.trim();
  return undefined;
}

function mapCompany(raw: Record<string, unknown>): CompanyHit {
  const id = (raw.id ?? raw.company_id ?? "") as string | number;
  const linkedin = (raw.linkedin_employee_count ?? raw.linkedin_employees_count) as number | undefined;
  const headcount6 = (raw.headcount_growth_6_months ?? raw.headcount_growth_6m) as number | undefined;
  const headcount12 = (raw.headcount_growth_12_months ?? raw.headcount_growth_12m) as number | undefined;
  const lastFunding = (raw.last_funding_round || raw.last_funding) as Record<string, unknown> | undefined;
  const techs = (raw.technologies || raw.tech_stack) as string[] | undefined;
  return {
    id,
    website: str(raw.website),
    name: str(raw.company_name) || str(raw.name),
    industry: str(raw.industry),
    size: str(raw.size) || str(raw.company_size),
    founded: (raw.founded_year as number | string | undefined) ?? num(raw.founded),
    hq_country: str(raw.hq_country) || str(raw.country),
    hq_city: str(raw.hq_city) || str(raw.city),
    short_description: str(raw.description) || str(raw.short_description),
    employees_count: linkedin ?? num(raw.employees_count),
    headcount_growth_6m: typeof headcount6 === "number" ? headcount6 : undefined,
    headcount_growth_12m: typeof headcount12 === "number" ? headcount12 : undefined,
    funding_total_usd: num(raw.funding_total_usd) ?? num(raw.total_funding_usd),
    last_funding_round: lastFunding ? {
      type: str(lastFunding.type),
      announced_date: str(lastFunding.announced_date) || str(lastFunding.date),
      amount_usd: num(lastFunding.amount_usd) ?? num(lastFunding.amount),
    } : undefined,
    technologies: Array.isArray(techs) ? techs.slice(0, 30).map(String) : undefined,
    active_job_postings_count: num(raw.active_job_postings_count) ?? num(raw.active_jobs_count),
    raw,
  };
}

async function fetchRecentJobs(companyId: string | number, signal?: AbortSignal): Promise<JobPosting[]> {
  const base = await resolveJobBase(signal);
  if (!base) return [];
  const ep = searchEndpoint(base);
  try {
    const ids = await postUrl<Array<string | number>>(ep.url, ep.body({ company_id: companyId, deleted: 0 }), signal);
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const sample = ids.slice(0, 8);
    const jobs: JobPosting[] = [];
    for (const id of sample) {
      try {
        const j = await getUrl<Record<string, unknown>>(`${base}/collect/${encodeURIComponent(String(id))}`, signal);
        jobs.push({
          title: str(j.title) || str(j.job_title),
          posted_date: str(j.posted_date) || str(j.created),
          location: str(j.location),
          function: str(j.function) || str(j.department),
          seniority: str(j.seniority_level) || str(j.seniority),
        });
      } catch {}
    }
    return jobs;
  } catch {
    return [];
  }
}

async function fetchCompanyMembers(companyId: string | number, titles: string[], postKeywords: string[], signal?: AbortSignal): Promise<MemberHit[]> {
  const cleanTitles = titles.map((t) => t.trim()).filter(Boolean).slice(0, 12);
  if (cleanTitles.length === 0) return [];
  const base = await resolveMemberBase(signal);
  if (!base) return [];
  const filter: Record<string, unknown> = {
    active_experience_company_id: companyId,
    active_experience_title: cleanTitles.join(" OR "),
  };
  let ids: Array<string | number> = [];
  const ep2 = searchEndpoint(base);
  try {
    ids = await postUrl<Array<string | number>>(ep2.url, ep2.body(filter), signal);
  } catch {
    return [];
  }
  if (!Array.isArray(ids) || ids.length === 0) return [];

  // Each /collect call = 1 credit. Cap members enriched per company to stay under budget.
  const remaining = Math.max(0, getCreditBudget() - creditsUsed);
  const perAccountCap = Math.min(5, remaining);
  const sample = ids.slice(0, perAccountCap);
  if (sample.length === 0) return [];
  const out: MemberHit[] = [];
  for (const id of sample) {
    try {
      const m = await getUrl<Record<string, unknown>>(`${base}/collect/${encodeURIComponent(String(id))}`, signal);
      const fullName = str(m.full_name) || `${str(m.first_name) || ""} ${str(m.last_name) || ""}`.trim();
      const exp = (m.experience as Array<Record<string, unknown>> | undefined) || [];
      const current = exp.find((e) => str(e.is_current) === "true" || e.is_current === true) || exp[0];
      const startedAt = current ? (str(current.date_from) || str(current.start_date)) : undefined;
      let months: number | undefined;
      if (startedAt) {
        const t = Date.parse(startedAt);
        if (!Number.isNaN(t)) months = Math.round((Date.now() - t) / (1000 * 60 * 60 * 24 * 30));
      }
      const shares = (m.shares as Array<Record<string, unknown>> | undefined) || (m.activities as Array<Record<string, unknown>> | undefined) || [];
      const filteredShares: MemberHit["recentActivity"] = [];
      const kw = postKeywords.map((k) => k.toLowerCase()).filter(Boolean);
      for (const s of shares.slice(0, 25)) {
        const text = str(s.text) || str(s.content) || "";
        if (!text) continue;
        const lt = text.toLowerCase();
        if (kw.length > 0 && !kw.some((k) => lt.includes(k))) continue;
        filteredShares.push({
          kind: (str(s.kind) === "comment" ? "comment" : str(s.kind) === "share" ? "share" : "post"),
          text: text.slice(0, 280),
          postedAt: str(s.posted_at) || str(s.date),
          engagement: num(s.engagement_count) ?? num(s.reactions_count),
        });
        if (filteredShares.length >= 5) break;
      }
      const previousCompanies = exp
        .filter((e) => e !== current)
        .slice(0, 4)
        .map((e) => ({
          company: str(e.company_name) || str(e.company),
          title: str(e.title) || str(e.position),
          from: str(e.date_from) || str(e.start_date),
          to: str(e.date_to) || str(e.end_date),
        }))
        .filter((p) => p.company);
      const education = (m.education as Array<Record<string, unknown>> | undefined) || [];
      const eduTop = education[0];
      const educationSummary = eduTop ? `${str(eduTop.degree) || str(eduTop.field_of_study) || "studied"} at ${str(eduTop.school_name) || str(eduTop.school)}` : undefined;

      out.push({
        id,
        fullName: fullName || undefined,
        title: current ? (str(current.title) || str(current.position)) : undefined,
        location: str(m.location_full) || str(m.location),
        startedCurrentRoleAt: startedAt,
        monthsInCurrentRole: months,
        skills: Array.isArray(m.skills) ? (m.skills as string[]).slice(0, 8).map(String) : undefined,
        recentActivity: filteredShares.length > 0 ? filteredShares : undefined,
        linkedinUrl: str(m.linkedin_url) || str(m.url),
        previousCompanies: previousCompanies.length > 0 ? previousCompanies : undefined,
        educationSummary,
      });
    } catch {}
  }
  return out;
}

// Per-lead lookup: find an EXACT CoreSignal member matching an Apollo stakeholder.
// Tries multiple search-filter shapes — CoreSignal's multi_source and base datasets accept
// different field names (linkedin_url, professional_network_url, full_name+company, name+company,
// active_experience_title+active_experience_company_id). We try them in order until one returns ids.
// Returns the parsed MemberHit or null. Cost: 0-N free searches + 1 collect (1 credit) on hit.
// On every failure path, console.warn the reason so the operator can see why this lead missed.
export interface FetchMemberForLeadResult {
  member: MemberHit | null;
  triedFilters: string[];
  searchErrors: string[];
  matchedVia: string | null;
}

export async function fetchMemberForLeadVerbose(
  args: { linkedinUrl?: string; fullName?: string; firstName?: string; lastName?: string; title?: string; companyId?: string | number | null; companyDomain?: string },
  signal?: AbortSignal,
): Promise<FetchMemberForLeadResult> {
  const triedFilters: string[] = [];
  const searchErrors: string[] = [];
  const result: FetchMemberForLeadResult = { member: null, triedFilters, searchErrors, matchedVia: null };
  if (!isCoreSignalLive()) { searchErrors.push("CORESIGNAL_API_KEY missing"); return result; }
  if (creditsUsed >= getCreditBudget()) { searchErrors.push(`credit budget exhausted (${creditsUsed}/${getCreditBudget()})`); return result; }

  const baseResolved = await resolveMemberBase(signal);
  if (!baseResolved) { searchErrors.push("could not resolve member endpoint (multi_source + base both unavailable)"); return result; }
  const base: string = baseResolved;
  const ep = searchEndpoint(base);

  async function trySearch(label: string, filter: Record<string, unknown>): Promise<MemberHit | null> {
    triedFilters.push(label);
    try {
      const ids = await postUrl<Array<string | number>>(ep.url, ep.body(filter), signal);
      if (Array.isArray(ids) && ids.length > 0) {
        const m = await collectMember(base, ids[0], signal);
        if (m) {
          result.matchedVia = label;
          return m;
        }
        searchErrors.push(`${label}: search returned id=${ids[0]} but collect failed`);
      }
    } catch (e) {
      const status = (e as { status?: number }).status;
      const msg = e instanceof Error ? e.message.slice(0, 140) : "unknown";
      searchErrors.push(`${label}: ${status ? `HTTP ${status} — ` : ""}${msg}`);
    }
    return null;
  }

  // 1) linkedin_url match — most precise. Try several URL formats and field-name variants.
  const url = (args.linkedinUrl || "").trim();
  if (url) {
    const cleaned = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
    const urlVariants = [cleaned, `https://${cleaned}`, `https://www.${cleaned}`, url];
    const fieldVariants = ["linkedin_url", "professional_network_url", "url"];
    for (const field of fieldVariants) {
      for (const v of urlVariants) {
        const m = await trySearch(`${field}=${v.slice(0, 60)}`, { [field]: v });
        if (m) { result.member = m; return result; }
      }
    }
  }

  // 2) Resolve company_id (free) then try name+company combos.
  let cid = args.companyId;
  if (!cid && args.companyDomain) {
    try { cid = await findCompanyId(args.companyDomain, signal); }
    catch (e) { searchErrors.push(`findCompanyId(${args.companyDomain}): ${e instanceof Error ? e.message.slice(0, 80) : "unknown"}`); }
  }

  const name = (args.fullName || `${args.firstName || ""} ${args.lastName || ""}`).trim();
  if (name && cid != null) {
    // Try multiple field-name combos that different CoreSignal tiers use.
    const filterCombos: Array<[string, Record<string, unknown>]> = [
      [`full_name+active_experience_company_id`, { full_name: name, active_experience_company_id: cid }],
      [`name+active_experience_company_id`, { name, active_experience_company_id: cid }],
      [`full_name+experience_company_id`, { full_name: name, experience_company_id: cid }],
      [`first+last+active_experience_company_id`, { first_name: args.firstName || "", last_name: args.lastName || "", active_experience_company_id: cid }],
    ];
    if (args.title) {
      filterCombos.push([`name+title+company`, { full_name: name, active_experience_title: args.title, active_experience_company_id: cid }]);
    }
    for (const [label, filter] of filterCombos) {
      // Skip combos with empty values
      if (Object.values(filter).some((v) => v === "" || v == null)) continue;
      const m = await trySearch(label, filter);
      if (m) { result.member = m; return result; }
    }
  } else if (name && !cid) {
    searchErrors.push(`no company_id resolved for ${args.companyDomain || "(no domain)"} — skipping name+company search`);
  }

  // 3) Last resort: name-only search (very broad, only works if the person has an unusual name).
  if (name && !result.member && (name.split(" ").length >= 2)) {
    const m = await trySearch(`full_name-only`, { full_name: name });
    if (m) { result.member = m; return result; }
  }

  return result;
}

// Backward-compatible wrapper that returns just the member (or null), warning to console on miss.
export async function fetchMemberForLead(
  args: { linkedinUrl?: string; fullName?: string; firstName?: string; lastName?: string; title?: string; companyId?: string | number | null; companyDomain?: string },
  signal?: AbortSignal,
): Promise<MemberHit | null> {
  const r = await fetchMemberForLeadVerbose(args, signal);
  if (!r.member) {
    const who = args.fullName || `${args.firstName || ""} ${args.lastName || ""}`.trim() || "?";
    console.warn(`[coresignal] miss: ${who} @ ${args.companyDomain || "?"} — tried [${r.triedFilters.join(", ")}] · errors: ${r.searchErrors.slice(0, 3).join(" | ") || "(none)"}`);
  } else {
    const who = args.fullName || `${args.firstName || ""} ${args.lastName || ""}`.trim() || "?";
    const postCount = r.member.recentActivity?.length || 0;
    console.log(`[coresignal] hit: ${who} @ ${args.companyDomain || "?"} via ${r.matchedVia} · posts=${postCount} · tenure=${r.member.monthsInCurrentRole || "?"}m`);
  }
  return r.member;
}

async function collectMember(base: string, id: string | number, signal?: AbortSignal): Promise<MemberHit | null> {
  if (creditsUsed >= getCreditBudget()) return null;
  try {
    const m = await getUrl<Record<string, unknown>>(`${base}/collect/${encodeURIComponent(String(id))}`, signal);
    creditsUsed++;
    return parseMember(id, m);
  } catch {
    return null;
  }
}

// Parse a CoreSignal member payload (multi_source OR base) into a MemberHit.
// multi_source returns more fields (shares, activities, recent_activity, member_shares_collection).
function parseMember(id: string | number, m: Record<string, unknown>): MemberHit {
  const fullName = str(m.full_name) || `${str(m.first_name) || ""} ${str(m.last_name) || ""}`.trim();
  const exp = (m.experience as Array<Record<string, unknown>> | undefined)
    || (m.member_experience_collection as Array<Record<string, unknown>> | undefined)
    || [];
  const current = exp.find((e) => str(e.is_current) === "true" || e.is_current === true) || exp[0];
  const startedAt = current ? (str(current.date_from) || str(current.start_date)) : undefined;
  let months: number | undefined;
  if (startedAt) {
    const t = Date.parse(startedAt);
    if (!Number.isNaN(t)) months = Math.round((Date.now() - t) / (1000 * 60 * 60 * 24 * 30));
  }
  // multi_source exposes shares/activities under multiple field names — try them all.
  const shares = (m.shares as Array<Record<string, unknown>> | undefined)
    || (m.activities as Array<Record<string, unknown>> | undefined)
    || (m.member_shares_collection as Array<Record<string, unknown>> | undefined)
    || (m.member_posts_collection as Array<Record<string, unknown>> | undefined)
    || (m.recent_activity as Array<Record<string, unknown>> | undefined)
    || [];
  const filteredShares: MemberHit["recentActivity"] = [];
  for (const s of shares.slice(0, 25)) {
    const text = str(s.text) || str(s.content) || str(s.description) || str(s.share_text) || "";
    if (!text) continue;
    filteredShares.push({
      kind: (str(s.kind) === "comment" ? "comment" : str(s.kind) === "share" ? "share" : "post"),
      text: text.slice(0, 320),
      postedAt: str(s.posted_at) || str(s.date) || str(s.published_at) || str(s.activity_date),
      engagement: num(s.engagement_count) ?? num(s.reactions_count) ?? num(s.likes_count),
    });
    if (filteredShares.length >= 8) break;
  }
  const previousCompanies = exp
    .filter((e) => e !== current)
    .slice(0, 4)
    .map((e) => ({
      company: str(e.company_name) || str(e.company),
      title: str(e.title) || str(e.position),
      from: str(e.date_from) || str(e.start_date),
      to: str(e.date_to) || str(e.end_date),
    }))
    .filter((p) => p.company);
  const education = (m.education as Array<Record<string, unknown>> | undefined)
    || (m.member_education_collection as Array<Record<string, unknown>> | undefined)
    || [];
  const eduTop = education[0];
  const educationSummary = eduTop ? `${str(eduTop.degree) || str(eduTop.field_of_study) || "studied"} at ${str(eduTop.school_name) || str(eduTop.school)}` : undefined;

  return {
    id,
    fullName: fullName || undefined,
    title: current ? (str(current.title) || str(current.position)) : str(m.headline),
    location: str(m.location_full) || str(m.location),
    startedCurrentRoleAt: startedAt,
    monthsInCurrentRole: months,
    skills: Array.isArray(m.skills) ? (m.skills as string[]).slice(0, 8).map(String) : undefined,
    recentActivity: filteredShares.length > 0 ? filteredShares : undefined,
    linkedinUrl: str(m.linkedin_url) || str(m.url),
    previousCompanies: previousCompanies.length > 0 ? previousCompanies : undefined,
    educationSummary,
  };
}

// Standalone "Lead intel" lookup: pull decision-makers + their full LinkedIn activity
// for a single account. Different from coreSignalSnapshot (which is account-level for the
// pipeline) — this one is purpose-built for the new Lead-intel tab where the operator wants
// to inspect WHAT each decision-maker has actually been posting, NOT a synthesised social angle.
//
// Returns the raw, unfiltered shares/activity for each member so the operator can read them
// and write a hand-tailored email per person.
export interface LeadIntelMember {
  id: string | number;
  fullName?: string;
  title?: string;
  headline?: string;
  location?: string;
  linkedinUrl?: string;
  monthsInCurrentRole?: number;
  startedCurrentRoleAt?: string;
  skills?: string[];
  educationSummary?: string;
  previousCompanies?: Array<{ company?: string; title?: string; from?: string; to?: string }>;
  recentActivity: Array<{ kind: string; text: string; postedAt?: string; engagement?: number }>;
}

export interface LeadIntelAccount {
  domain: string;
  companyId: string | number | null;
  companyName?: string;
  companyIndustry?: string;
  companyEmployees?: number;
  members: LeadIntelMember[];
  errors: string[];
  triedFilters: string[];
  endpointUsed?: string;
  // Strict-match diagnostics: which candidate companies were checked and rejected
  // because their website didn't match the requested domain exactly.
  candidatesTotal?: number;
  candidatesChecked?: number;
  rejectedCandidates?: Array<{ id: string | number; website?: string; name?: string }>;
}

export async function fetchLeadIntelForAccount(
  domain: string,
  opts: { titles?: string[]; maxMembers?: number; postLimitPerMember?: number } = {},
  signal?: AbortSignal,
): Promise<LeadIntelAccount> {
  const result: LeadIntelAccount = {
    domain,
    companyId: null,
    members: [],
    errors: [],
    triedFilters: [],
  };
  if (!isCoreSignalLive()) { result.errors.push("CORESIGNAL_API_KEY missing"); return result; }

  // Strict company resolution — verifies the candidate's website matches the requested
  // domain exactly. Prevents the "libas.in" → "libaas.com" / "libasify.com" misroute.
  let resolution: CompanyResolution = { id: null, candidatesChecked: 0, candidatesTotal: 0, rejected: [] };
  try { resolution = await findCompanyIdVerified(domain, signal); }
  catch (e) { result.errors.push(`findCompanyIdVerified(${domain}): ${e instanceof Error ? e.message.slice(0, 200) : "unknown"}`); }
  result.candidatesTotal = resolution.candidatesTotal;
  result.candidatesChecked = resolution.candidatesChecked;
  result.rejectedCandidates = resolution.rejected;
  // Each verification call to /collect costs 1 credit — count them.
  if (resolution.candidatesChecked > 0) creditsUsed += resolution.candidatesChecked;

  if (resolution.id == null) {
    if (resolution.candidatesTotal > 0) {
      result.errors.push(`no candidate website matched ${domain} exactly. ${resolution.candidatesTotal} candidate(s) found by fuzzy search, ${resolution.candidatesChecked} verified, all rejected. Check rejectedCandidates for what CoreSignal returned.`);
    } else {
      result.errors.push(`no companies in CoreSignal index match website ${domain} (or its variants).`);
    }
    return result;
  }
  result.companyId = resolution.id;

  // Fetch company details (already paid for via the verification step — read-through cache).
  const company = await fetchCompany(resolution.id, signal);
  if (company) {
    result.companyName = company.name;
    result.companyIndustry = company.industry;
    result.companyEmployees = company.employees_count;
  }

  // Resolve member endpoint (multi_source first, base fallback).
  const base = await resolveMemberBase(signal);
  if (!base) { result.errors.push("could not resolve CoreSignal member endpoint"); return result; }
  result.endpointUsed = base;

  // Search decision-maker IDs at this company. Try several filter shapes.
  const titles = (opts.titles && opts.titles.length > 0)
    ? opts.titles
    : ["CEO", "Chief Executive Officer", "Founder", "Co-Founder", "Director", "VP", "Vice President", "Head", "Chief", "President", "Managing Director"];
  const ep = searchEndpoint(base);
  let memberIds: Array<string | number> = [];

  // Coerce company_id to number when possible — CoreSignal's filter API typically expects integers.
  const verifiedCompanyId = resolution.id!;
  const cidNum = typeof verifiedCompanyId === "number" ? verifiedCompanyId : (Number.isFinite(Number(verifiedCompanyId)) ? Number(verifiedCompanyId) : verifiedCompanyId);

  // Build attempts for BOTH /search/filter (key-value) AND /search/es_dsl (Elasticsearch query DSL).
  // employee_base typically rejects nested-OR title syntax in filter mode → try first title alone,
  // then ES_DSL bool/should query for multiple titles.
  const filterUrl = `${base}/search/filter`;
  const esDslUrl = `${base}/search/es_dsl`;
  const firstTitle = titles[0] || "";

  const attempts: Array<{ label: string; url: string; body: Record<string, unknown> }> = [
    // /search/filter — try minimal field shapes first (the 422 we saw rejected the multi-field combo).
    { label: `filter: active_experience_company_id-only`, url: filterUrl, body: { active_experience_company_id: cidNum } },
    { label: `filter: experience_company_id-only`, url: filterUrl, body: { experience_company_id: cidNum } },
    { label: `filter: company_id`, url: filterUrl, body: { company_id: cidNum } },
    { label: `filter: active_experience_company_id + first_title`, url: filterUrl, body: { active_experience_company_id: cidNum, active_experience_title: firstTitle } },
    // /search/es_dsl — Elasticsearch query DSL with bool/should for titles
    {
      label: `es_dsl: experience.company_id + experience.is_current`,
      url: esDslUrl,
      body: {
        query: {
          bool: {
            must: [
              { match: { "experience.company_id": cidNum } },
              { match: { "experience.is_current": true } },
            ],
          },
        },
      },
    },
    {
      label: `es_dsl: active_experience.company_id`,
      url: esDslUrl,
      body: {
        query: { match: { "active_experience.company_id": cidNum } },
      },
    },
    {
      label: `es_dsl: active_experience.company_id + title-should`,
      url: esDslUrl,
      body: {
        query: {
          bool: {
            must: [{ match: { "active_experience.company_id": cidNum } }],
            should: titles.map((t) => ({ match_phrase: { "active_experience.title": t } })),
            minimum_should_match: titles.length > 0 ? 1 : 0,
          },
        },
      },
    },
    {
      label: `es_dsl: experience-nested company_id + is_current + title`,
      url: esDslUrl,
      body: {
        query: {
          nested: {
            path: "experience",
            query: {
              bool: {
                must: [
                  { match: { "experience.company_id": cidNum } },
                  { match: { "experience.is_current": true } },
                ],
                should: titles.map((t) => ({ match_phrase: { "experience.title": t } })),
                minimum_should_match: titles.length > 0 ? 1 : 0,
              },
            },
          },
        },
      },
    },
  ];

  for (const a of attempts) {
    result.triedFilters.push(a.label);
    try {
      const ids = await postUrl<Array<string | number>>(a.url, a.body, signal);
      if (Array.isArray(ids) && ids.length > 0) {
        memberIds = ids;
        result.endpointUsed = a.url;
        break;
      } else {
        result.errors.push(`${a.label}: 200 OK but 0 ids returned`);
      }
    } catch (e) {
      const status = (e as { status?: number }).status;
      // Surface the FULL error message — the 422 detail tells us exactly what fields the API accepts.
      result.errors.push(`${a.label}: ${status ? `HTTP ${status} — ` : ""}${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  if (memberIds.length === 0) {
    if (result.errors.length === 0) result.errors.push("no member IDs returned from any filter");
    return result;
  }

  // Collect each member's full payload. Each /collect = 1 credit.
  const cap = Math.min(opts.maxMembers ?? 10, memberIds.length, Math.max(0, getCreditBudget() - creditsUsed));
  const sample = memberIds.slice(0, cap);
  const postCap = opts.postLimitPerMember ?? 10;

  for (const id of sample) {
    if (signal?.aborted) break;
    try {
      const m = await getUrl<Record<string, unknown>>(`${base}/collect/${encodeURIComponent(String(id))}`, signal);
      creditsUsed++;
      const member = parseMemberForLeadIntel(id, m, postCap);
      if (member) result.members.push(member);
    } catch (e) {
      result.errors.push(`collect(${id}): ${e instanceof Error ? e.message.slice(0, 100) : "unknown"}`);
    }
  }

  return result;
}

// Variant of parseMember that returns the FULL recentActivity (no topic filtering, no length cap)
// so the operator can read each post in full. Reads all known field-name variants.
function parseMemberForLeadIntel(id: string | number, m: Record<string, unknown>, postCap: number): LeadIntelMember {
  const fullName = str(m.full_name) || `${str(m.first_name) || ""} ${str(m.last_name) || ""}`.trim();
  const exp = (m.experience as Array<Record<string, unknown>> | undefined)
    || (m.member_experience_collection as Array<Record<string, unknown>> | undefined)
    || [];
  const current = exp.find((e) => str(e.is_current) === "true" || e.is_current === true) || exp[0];
  const startedAt = current ? (str(current.date_from) || str(current.start_date)) : undefined;
  let months: number | undefined;
  if (startedAt) {
    const t = Date.parse(startedAt);
    if (!Number.isNaN(t)) months = Math.round((Date.now() - t) / (1000 * 60 * 60 * 24 * 30));
  }

  const sharesRaw = (m.shares as Array<Record<string, unknown>> | undefined)
    || (m.activities as Array<Record<string, unknown>> | undefined)
    || (m.member_shares_collection as Array<Record<string, unknown>> | undefined)
    || (m.member_posts_collection as Array<Record<string, unknown>> | undefined)
    || (m.member_activities_collection as Array<Record<string, unknown>> | undefined)
    || (m.recent_activity as Array<Record<string, unknown>> | undefined)
    || (m.recent_activities as Array<Record<string, unknown>> | undefined)
    || [];

  const recentActivity: LeadIntelMember["recentActivity"] = [];
  for (const s of sharesRaw.slice(0, postCap)) {
    const text = str(s.text) || str(s.content) || str(s.description) || str(s.share_text) || str(s.activity_text) || "";
    if (!text) continue;
    recentActivity.push({
      kind: str(s.kind) || str(s.activity_type) || str(s.type) || "post",
      text,
      postedAt: str(s.posted_at) || str(s.date) || str(s.published_at) || str(s.activity_date) || str(s.created_at),
      engagement: num(s.engagement_count) ?? num(s.reactions_count) ?? num(s.likes_count) ?? num(s.num_likes),
    });
  }

  const previousCompanies = exp
    .filter((e) => e !== current)
    .slice(0, 6)
    .map((e) => ({
      company: str(e.company_name) || str(e.company),
      title: str(e.title) || str(e.position),
      from: str(e.date_from) || str(e.start_date),
      to: str(e.date_to) || str(e.end_date),
    }))
    .filter((p) => p.company);

  const education = (m.education as Array<Record<string, unknown>> | undefined)
    || (m.member_education_collection as Array<Record<string, unknown>> | undefined)
    || [];
  const eduTop = education[0];
  const educationSummary = eduTop ? `${str(eduTop.degree) || str(eduTop.field_of_study) || "studied"} at ${str(eduTop.school_name) || str(eduTop.school)}` : undefined;

  return {
    id,
    fullName: fullName || undefined,
    title: current ? (str(current.title) || str(current.position)) : str(m.headline),
    headline: str(m.headline) || str(m.summary),
    location: str(m.location_full) || str(m.location),
    linkedinUrl: str(m.linkedin_url) || str(m.url),
    monthsInCurrentRole: months,
    startedCurrentRoleAt: startedAt,
    skills: Array.isArray(m.skills) ? (m.skills as string[]).slice(0, 12).map(String) : undefined,
    educationSummary,
    previousCompanies: previousCompanies.length > 0 ? previousCompanies : undefined,
    recentActivity,
  };
}

export interface SnapshotOptions {
  championTitles?: string[];
  postKeywords?: string[];
  skipMembers?: boolean;
}

export async function coreSignalSnapshot(domain: string, signal?: AbortSignal, opts: SnapshotOptions = {}): Promise<CoreSignalSnapshot> {
  const errors: string[] = [];
  const snapshot: CoreSignalSnapshot = {
    domain, company: null, recentJobs: [], members: [], fetchedAt: new Date().toISOString(), errors,
  };
  if (!isCoreSignalLive()) { errors.push("CORESIGNAL_API_KEY missing"); return snapshot; }

  const budget = getCreditBudget();
  if (creditsUsed >= budget) {
    errors.push(`CoreSignal credit budget exhausted (${creditsUsed}/${budget}). Skipping.`);
    return snapshot;
  }

  let companyId: string | number | null = null;
  try { companyId = await findCompanyId(domain, signal); }
  catch (e) { errors.push(`findCompanyId: ${e instanceof Error ? e.message : "unknown"}`); }
  if (companyId == null) { errors.push("company not found by domain"); return snapshot; }

  const remaining = budget - creditsUsed;
  const willFetchCompany = true;
  // Jobs API is permanently disabled in cost-minimised config.
  const willFetchJobs = false;
  const wantsMembers = !opts.skipMembers && opts.championTitles && opts.championTitles.length > 0;
  const willFetchMembers = wantsMembers && remaining > 1;

  const [company, jobs, members] = await Promise.all([
    willFetchCompany ? fetchCompany(companyId, signal) : Promise.resolve(null),
    Promise.resolve([] as JobPosting[]),
    willFetchMembers ? fetchCompanyMembers(companyId, opts.championTitles!, opts.postKeywords || [], signal) : Promise.resolve([] as MemberHit[]),
  ]);

  if (willFetchCompany && company) creditsUsed++;
  // Each member.collect call = 1 credit. fetchCompanyMembers caps at 8 internally.
  if (willFetchMembers && members.length > 0) creditsUsed += members.length;

  if (creditsUsed >= budget) {
    errors.push(`CoreSignal credit cap reached (${creditsUsed}/${budget}) — subsequent accounts will be skipped.`);
  }

  snapshot.company = company;
  if (snapshot.company) snapshot.company.id = companyId;
  snapshot.recentJobs = jobs;
  snapshot.members = members;
  return snapshot;
}

export function summarizeCoreSignal(snapshot: CoreSignalSnapshot): string {
  if (!snapshot.company && snapshot.recentJobs.length === 0 && snapshot.members.length === 0) {
    return `(no CoreSignal data for ${snapshot.domain}${snapshot.errors.length > 0 ? `; errors: ${snapshot.errors.slice(0, 2).join("; ")}` : ""})`;
  }
  const c = snapshot.company;
  const lines: string[] = [];
  if (c) {
    lines.push(`COMPANY (CoreSignal)`);
    if (c.short_description) lines.push(`- description: ${c.short_description.slice(0, 280)}`);
    if (c.industry) lines.push(`- industry: ${c.industry}`);
    if (c.employees_count != null) lines.push(`- employees: ${c.employees_count}`);
    if (c.headcount_growth_6m != null) lines.push(`- headcount growth (6m): ${(c.headcount_growth_6m * 100).toFixed(1)}%`);
    if (c.headcount_growth_12m != null) lines.push(`- headcount growth (12m): ${(c.headcount_growth_12m * 100).toFixed(1)}%`);
    if (c.last_funding_round) {
      const f = c.last_funding_round;
      const parts: string[] = [];
      if (f.type) parts.push(f.type);
      if (f.amount_usd) parts.push(`$${(f.amount_usd / 1e6).toFixed(1)}M`);
      if (f.announced_date) parts.push(f.announced_date);
      if (parts.length > 0) lines.push(`- last funding: ${parts.join(" · ")}`);
    }
    if (c.technologies && c.technologies.length > 0) lines.push(`- tech stack: ${c.technologies.slice(0, 10).join(", ")}`);
    if (c.active_job_postings_count != null) lines.push(`- active job postings: ${c.active_job_postings_count}`);
  }
  if (snapshot.recentJobs.length > 0) {
    lines.push(``);
    lines.push(`RECENT JOB POSTINGS (CoreSignal — top ${Math.min(8, snapshot.recentJobs.length)})`);
    for (const j of snapshot.recentJobs.slice(0, 8)) {
      const parts: string[] = [];
      if (j.title) parts.push(j.title);
      if (j.function) parts.push(`fn: ${j.function}`);
      if (j.seniority) parts.push(j.seniority);
      if (j.location) parts.push(j.location);
      if (j.posted_date) parts.push(j.posted_date);
      if (parts.length > 0) lines.push(`- ${parts.join(" · ")}`);
    }
  }
  if (snapshot.members.length > 0) {
    lines.push(``);
    lines.push(`KEY PEOPLE AT THIS ACCOUNT (CoreSignal — champion-titled, top ${Math.min(6, snapshot.members.length)})`);
    for (const m of snapshot.members.slice(0, 6)) {
      const head: string[] = [];
      if (m.fullName) head.push(m.fullName);
      if (m.title) head.push(m.title);
      if (m.location) head.push(m.location);
      if (typeof m.monthsInCurrentRole === "number") head.push(`${m.monthsInCurrentRole}mo in role`);
      lines.push(`- ${head.join(" · ")}`);
      if (m.linkedinUrl) lines.push(`  ${m.linkedinUrl}`);
      if (m.recentActivity && m.recentActivity.length > 0) {
        for (const a of m.recentActivity.slice(0, 3)) {
          const meta = [a.kind, a.postedAt, a.engagement != null ? `${a.engagement} reactions` : null].filter(Boolean).join(" · ");
          lines.push(`  • ${meta}: "${(a.text || "").replace(/\s+/g, " ").trim().slice(0, 200)}"`);
        }
      }
    }
  }

  return lines.join("\n").slice(0, 4000);
}
