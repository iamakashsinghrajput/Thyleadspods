const BASE_OVERRIDE = (process.env.CORESIGNAL_BASE_URL || "").replace(/\/+$/, "");

const COMPANY_PATHS = [
  "/cdapi/v2/company_multi_source",
  "/cdapi/v2/professional_network_company",
  "/cdapi/v1/professional_network/company",
  "/cdapi/v1/linkedin/company",
];
const MEMBER_PATHS = [
  "/cdapi/v2/member_multi_source",
  "/cdapi/v1/professional_network/member",
  "/cdapi/v1/linkedin/member",
];
const JOB_PATHS = [
  "/cdapi/v2/job_multi_source",
  "/cdapi/v1/jobs",
];

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
}

async function postUrl<T>(url: string, body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const apiKey = (process.env.CORESIGNAL_API_KEY || "").trim();
  if (!apiKey) throw new Error("CORESIGNAL_API_KEY missing");
  const { withTimeout } = await import("./fetch-signal");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": apiKey, "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: withTimeout(signal, 15000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const err = new Error(`coresignal ${url} ${res.status}: ${txt.slice(0, 200)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

async function getUrl<T>(url: string, signal?: AbortSignal): Promise<T> {
  const apiKey = (process.env.CORESIGNAL_API_KEY || "").trim();
  if (!apiKey) throw new Error("CORESIGNAL_API_KEY missing");
  const { withTimeout } = await import("./fetch-signal");
  const res = await fetch(url, {
    method: "GET",
    headers: { "apikey": apiKey, "Authorization": `Bearer ${apiKey}` },
    signal: withTimeout(signal, 15000),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    const err = new Error(`coresignal ${url} ${res.status}: ${txt.slice(0, 200)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.json() as Promise<T>;
}

async function resolveCompanyBase(signal?: AbortSignal): Promise<string | null> {
  if (resolvedCompanyBase) return resolvedCompanyBase;
  const root = rootBase();
  for (const p of COMPANY_PATHS) {
    const url = `${root}${p}/search/filter`;
    try {
      const data = await postUrl<unknown>(url, { website: "google.com" }, signal);
      void data;
      resolvedCompanyBase = `${root}${p}`;
      return resolvedCompanyBase;
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 404) continue;
      if (status === 401 || status === 403) {
        resolvedCompanyBase = `${root}${p}`;
        return resolvedCompanyBase;
      }
      continue;
    }
  }
  return null;
}

async function resolveMemberBase(signal?: AbortSignal): Promise<string | null> {
  if (resolvedMemberBase) return resolvedMemberBase;
  const companyBase = resolvedCompanyBase || await resolveCompanyBase(signal);
  if (companyBase) {
    if (companyBase.includes("/v2/")) { resolvedMemberBase = `${rootBase()}/cdapi/v2/member_multi_source`; return resolvedMemberBase; }
    if (companyBase.includes("/professional_network/")) { resolvedMemberBase = `${rootBase()}/cdapi/v1/professional_network/member`; return resolvedMemberBase; }
    if (companyBase.includes("/linkedin/")) { resolvedMemberBase = `${rootBase()}/cdapi/v1/linkedin/member`; return resolvedMemberBase; }
  }
  for (const p of MEMBER_PATHS) {
    resolvedMemberBase = `${rootBase()}${p}`;
    return resolvedMemberBase;
  }
  return null;
}

async function resolveJobBase(signal?: AbortSignal): Promise<string | null> {
  if (resolvedJobBase) return resolvedJobBase;
  const companyBase = resolvedCompanyBase || await resolveCompanyBase(signal);
  if (companyBase?.includes("/v2/")) { resolvedJobBase = `${rootBase()}/cdapi/v2/job_multi_source`; return resolvedJobBase; }
  resolvedJobBase = `${rootBase()}/cdapi/v1/jobs`;
  return resolvedJobBase;
}

async function findCompanyId(domain: string, signal?: AbortSignal): Promise<string | number | null> {
  const base = await resolveCompanyBase(signal);
  if (!base) return null;
  const variants = [domain, `www.${domain}`, `https://${domain}`, `https://www.${domain}`];
  for (const v of variants) {
    try {
      const ids = await postUrl<Array<string | number>>(`${base}/search/filter`, { website: v }, signal);
      if (Array.isArray(ids) && ids.length > 0) return ids[0];
    } catch {}
  }
  return null;
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
  try {
    const ids = await postUrl<Array<string | number>>(`${base}/search/filter`, { company_id: companyId, deleted: 0 }, signal);
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
  try {
    ids = await postUrl<Array<string | number>>(`${base}/search/filter`, filter, signal);
  } catch {
    return [];
  }
  if (!Array.isArray(ids) || ids.length === 0) return [];

  const sample = ids.slice(0, 6);
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
      });
    } catch {}
  }
  return out;
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

  let companyId: string | number | null = null;
  try { companyId = await findCompanyId(domain, signal); }
  catch (e) { errors.push(`findCompanyId: ${e instanceof Error ? e.message : "unknown"}`); }
  if (companyId == null) { errors.push("company not found by domain"); return snapshot; }

  const [company, jobs, members] = await Promise.all([
    fetchCompany(companyId, signal),
    fetchRecentJobs(companyId, signal),
    opts.skipMembers || !(opts.championTitles && opts.championTitles.length > 0)
      ? Promise.resolve([] as MemberHit[])
      : fetchCompanyMembers(companyId, opts.championTitles, opts.postKeywords || [], signal),
  ]);

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
