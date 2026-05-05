const BASE = (process.env.CORESIGNAL_BASE_URL || "https://api.coresignal.com/cdapi/v2").replace(/\/+$/, "");

export function isCoreSignalLive(): boolean {
  return !!(process.env.CORESIGNAL_API_KEY || "").trim();
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
  fetchedAt: string;
  errors: string[];
}

async function postJson<T>(path: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const apiKey = (process.env.CORESIGNAL_API_KEY || "").trim();
  if (!apiKey) throw new Error("CORESIGNAL_API_KEY missing");
  const { withTimeout } = await import("./fetch-signal");
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": apiKey, "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: withTimeout(signal, 15000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`coresignal ${path} ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const apiKey = (process.env.CORESIGNAL_API_KEY || "").trim();
  if (!apiKey) throw new Error("CORESIGNAL_API_KEY missing");
  const { withTimeout } = await import("./fetch-signal");
  const res = await fetch(`${BASE}${path}`, {
    method: "GET",
    headers: { "apikey": apiKey, "Authorization": `Bearer ${apiKey}` },
    signal: withTimeout(signal, 15000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`coresignal ${path} ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function findCompanyId(domain: string, signal?: AbortSignal): Promise<string | number | null> {
  const variants = [domain, `www.${domain}`, `https://${domain}`, `https://www.${domain}`];
  try {
    const ids = await postJson<Array<string | number>>(
      "/company_multi_source/search/filter",
      { website: variants[0] },
      signal,
    );
    if (Array.isArray(ids) && ids.length > 0) return ids[0];
  } catch {}
  for (const v of variants.slice(1)) {
    try {
      const ids = await postJson<Array<string | number>>(
        "/company_multi_source/search/filter",
        { website: v },
        signal,
      );
      if (Array.isArray(ids) && ids.length > 0) return ids[0];
    } catch {}
  }
  return null;
}

async function fetchCompany(id: string | number, signal?: AbortSignal): Promise<CompanyHit | null> {
  try {
    const raw = await getJson<Record<string, unknown>>(`/company_multi_source/collect/${encodeURIComponent(String(id))}`, signal);
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
  try {
    const ids = await postJson<Array<string | number>>(
      "/jobs/search/filter",
      { company_id: companyId, deleted: 0 },
      signal,
    );
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const sample = ids.slice(0, 8);
    const jobs: JobPosting[] = [];
    for (const id of sample) {
      try {
        const j = await getJson<Record<string, unknown>>(`/jobs/collect/${encodeURIComponent(String(id))}`, signal);
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

export async function coreSignalSnapshot(domain: string, signal?: AbortSignal): Promise<CoreSignalSnapshot> {
  const errors: string[] = [];
  const snapshot: CoreSignalSnapshot = {
    domain, company: null, recentJobs: [], fetchedAt: new Date().toISOString(), errors,
  };
  if (!isCoreSignalLive()) { errors.push("CORESIGNAL_API_KEY missing"); return snapshot; }

  let companyId: string | number | null = null;
  try { companyId = await findCompanyId(domain, signal); }
  catch (e) { errors.push(`findCompanyId: ${e instanceof Error ? e.message : "unknown"}`); }
  if (companyId == null) { errors.push("company not found by domain"); return snapshot; }

  snapshot.company = await fetchCompany(companyId, signal);
  if (snapshot.company) snapshot.company.id = companyId;

  snapshot.recentJobs = await fetchRecentJobs(companyId, signal);
  return snapshot;
}

export function summarizeCoreSignal(snapshot: CoreSignalSnapshot): string {
  if (!snapshot.company && snapshot.recentJobs.length === 0) {
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
  return lines.join("\n").slice(0, 2400);
}
