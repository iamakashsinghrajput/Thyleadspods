import type { ScoredAccount, Stakeholder, PhaseState } from "../types";
import { makePersonKey } from "../types";
import { withTimeout, APOLLO_FETCH_TIMEOUT_MS } from "../fetch-signal";

const LEADS_PER_ACCOUNT = 5;

export interface StakeholderInput {
  topAccounts: ScoredAccount[];
  championTitles: string[];
  concurrency?: number;
  shouldCancel?: () => Promise<boolean>;
  signal?: AbortSignal;
  onAccount?: (row: StakeholderRow, index: number) => Promise<void>;
}

export interface StakeholderRow {
  account: ScoredAccount;
  stakeholder: Stakeholder | null;
}

export interface StakeholderOutput {
  rows: StakeholderRow[];
  found: number;
  missed: number;
}

interface ApolloPersonRow {
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  linkedin_url?: string;
  seniority?: string;
  organization?: {
    primary_domain?: string;
    name?: string;
    website_url?: string;
  };
  organization_id?: string;
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

// Strict-match guard: only keep people whose Apollo organization.primary_domain matches
// the requested domain root. Apollo can return people from acquired/parent companies or
// alias domains (libas.in → libaas.in / libaas.com / libasify.com), so without this filter
// we'd pull leads from the wrong company.
//
// CRITICAL: rows without organization data are REJECTED, not kept. Apollo's name-based
// fallback search can return mixed results from similarly-named orgs, and we can't verify
// them — better to lose an unverifiable lead than ship one from the wrong company.
function filterPeopleByDomain(people: ApolloPersonRow[], targetDomain: string): { kept: ApolloPersonRow[]; rejected: Array<{ person: ApolloPersonRow; orgDomain?: string; reason: string }> } {
  const targetRoot = normaliseDomainRoot(targetDomain);
  const kept: ApolloPersonRow[] = [];
  const rejected: Array<{ person: ApolloPersonRow; orgDomain?: string; reason: string }> = [];
  for (const p of people) {
    const orgDomainRaw = p.organization?.primary_domain || p.organization?.website_url || "";
    const orgRoot = normaliseDomainRoot(orgDomainRaw);
    if (!orgRoot) {
      // Apollo omitted organization details on this row — we cannot verify which company
      // this person actually belongs to, so we reject. This closes the hole where the
      // name-based fallback search returned people from "Libaas" (with no org details)
      // when the operator asked for "libas.in".
      rejected.push({ person: p, orgDomain: undefined, reason: "no_organization_data" });
      continue;
    }
    if (orgRoot === targetRoot) {
      kept.push(p);
    } else {
      rejected.push({ person: p, orgDomain: orgDomainRaw, reason: `org_domain_mismatch:${orgRoot}` });
    }
  }
  return { kept, rejected };
}

const DECISION_MAKER_TITLES = [
  "founder", "co-founder", "cofounder",
  "ceo", "chief executive officer",
  "coo", "chief operating officer",
  "cto", "chief technology officer",
  "cmo", "chief marketing officer",
  "cpo", "chief product officer",
  "cgo", "chief growth officer",
  "cro", "chief revenue officer",
  "cfo", "chief financial officer",
  "owner", "managing director", "president",
];

function mergeDecisionMakerTitles(userTitles: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of [...DECISION_MAKER_TITLES, ...userTitles]) {
    const k = (t || "").trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

async function searchPeopleApollo(domain: string, titles: string[], apiKey: string, signal?: AbortSignal): Promise<ApolloPersonRow[]> {
  const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({
      q_organization_domains_list: [domain],
      person_titles: titles,
      person_seniorities: ["owner", "founder", "c_suite", "vp", "head"],
      include_similar_titles: true,
      per_page: 25,
    }),
    signal: withTimeout(signal, APOLLO_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`apollo people search ${res.status}`);
  const data = (await res.json()) as { people?: ApolloPersonRow[]; contacts?: ApolloPersonRow[] };
  return data.people || data.contacts || [];
}

// Fallback for domains Apollo doesn't index by primary_domain (e.g. bikewale.com,
// libas.in — owned by parent companies in Apollo). Search by company-name keyword.
async function searchPeopleByCompanyName(name: string, titles: string[], apiKey: string, signal?: AbortSignal): Promise<ApolloPersonRow[]> {
  if (!name) return [];
  const res = await fetch("https://api.apollo.io/v1/mixed_people/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
    body: JSON.stringify({
      q_organization_name: name,
      person_titles: titles,
      person_seniorities: ["owner", "founder", "c_suite", "vp", "head"],
      include_similar_titles: true,
      per_page: 25,
    }),
    signal: withTimeout(signal, APOLLO_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`apollo people name-search ${res.status}`);
  const data = (await res.json()) as { people?: ApolloPersonRow[]; contacts?: ApolloPersonRow[] };
  return data.people || data.contacts || [];
}

const SENIORITY_RANK: Record<string, number> = {
  "owner": 7, "founder": 7, "c_suite": 5, "vp": 4, "head": 4, "director": 3, "senior": 2, "manager": 1, "individual_contributor": 0,
};

// Titles that LOOK like decision-makers but aren't — exclude entirely.
// Examples: "Franchise Owner" owns a single franchise outlet (not the company).
// "Founder's Office" is an EA / chief-of-staff role, not the founder themselves.
const EXCLUDE_TITLE_PATTERNS = [
  /\bfranchis(e|ee|or)\b/,
  /\bfranchise\s+(owner|partner|holder)\b/,
  /\bfounders?'?\s*office\b/,
  /\boffice\s+of\s+(the\s+)?(founder|ceo|chairman|md)\b/,
  /\bchief\s+of\s+staff\b/,
  /\b(executive|personal)\s+assistant\b/,
  /\bea\s+to\s+(the\s+)?(ceo|founder|md|chairman)\b/,
  /\bsecretary\s+to\s+(the\s+)?(ceo|founder|md|chairman)\b/,
  /\bintern\b/,
  /\btrainee\b/,
  /\bowner\s*[-–]\s*franchise\b/,
];

function isExcludedTitle(lt: string): boolean {
  return EXCLUDE_TITLE_PATTERNS.some((p) => p.test(lt));
}

function strongerTitle(t: string): number {
  const lt = t.toLowerCase();
  if (isExcludedTitle(lt)) return 0;
  if (/\b(founder|co[- ]?founder|cofounder)\b/.test(lt)) return 14;
  if (/\b(ceo|chief executive officer)\b/.test(lt)) return 13;
  if (/\b(coo|cto|cfo|chief operating officer|chief technology officer|chief financial officer)\b/.test(lt)) return 11;
  if (/\b(cmo|cpo|cgo|cro|chief marketing|chief product|chief growth|chief revenue)\b/.test(lt)) return 10;
  if (/\bchief\b/.test(lt)) return 9;
  if (/\bowner\b/.test(lt) || /\bmanaging director\b/.test(lt) || /\bmd\b/.test(lt)) return 9;
  if (/\bpresident\b/.test(lt)) return 9;
  if (lt.includes("head of growth") || lt.includes("vp growth") || lt.includes("vp of growth")) return 8;
  if (lt.includes("head of marketing") || lt.includes("vp marketing")) return 8;
  if (lt.includes("head of digital marketing")) return 7;
  if (lt.includes("head of product") || lt.includes("vp product")) return 7;
  if (lt.includes("head of d2c") || lt.includes("head of ecommerce")) return 7;
  if (lt.includes("director")) return 5;
  if (lt.includes("senior product manager")) return 6;
  if (lt.includes("product manager")) return 4;
  if (lt.includes("manager")) return 2;
  if (lt.includes("assistant manager") || lt.includes("senior associate")) return 0;
  return 1;
}

function tierFor(title: string): string {
  const lt = (title || "").toLowerCase();
  if (isExcludedTitle(lt)) return "excluded";
  if (/\b(founder|co[- ]?founder|cofounder)\b/.test(lt)) return "founder";
  if (/\b(ceo|chief executive)\b/.test(lt)) return "CEO";
  if (/\bchief\b/.test(lt) || /\b(coo|cto|cfo|cmo|cpo|cgo|cro)\b/.test(lt)) return "chief-level";
  if (/\bowner\b/.test(lt) || /\bmanaging director\b|\bmd\b/.test(lt) || /\bpresident\b/.test(lt)) return "owner/MD";
  if (/\bhead\b|\bvp\b/.test(lt)) return "head/VP";
  if (/\bdirector\b/.test(lt)) return "director";
  return "senior";
}

function pickTopN(people: ApolloPersonRow[], n: number): { person: ApolloPersonRow; tier: string }[] {
  if (people.length === 0) return [];
  const ranked = people
    .map((p) => ({
      p,
      score: strongerTitle(p.title || "") + (SENIORITY_RANK[(p.seniority || "").toLowerCase()] || 0) + (p.linkedin_url ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .filter((r) => r.score >= 1);

  const out: { person: ApolloPersonRow; tier: string }[] = [];
  const seen = new Set<string>();
  for (const r of ranked) {
    if (out.length >= n) break;
    const key = (r.p.linkedin_url || r.p.name || `${r.p.first_name || ""}-${r.p.last_name || ""}`).toLowerCase().trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ person: r.p, tier: tierFor(r.p.title || "") });
  }
  return out;
}

function mockPickMany(account: ScoredAccount, n: number): Stakeholder[] {
  const ROLES = [
    "Founder", "Co-Founder", "CEO", "Founder & CEO",
    "COO", "CTO", "CMO",
    "Head of Growth", "Head of Marketing", "VP Marketing",
    "Head of D2C", "Director of Growth",
  ];
  const FIRST = ["Subhash", "Akshika", "Rohit", "Priya", "Aditya", "Neha", "Vikram", "Anjali", "Kunal", "Riya"];
  const LAST = ["Dawda", "Poddar", "Sharma", "Iyer", "Patel", "Mehta", "Singh", "Kapoor", "Banerjee", "Reddy"];
  const out: Stakeholder[] = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.abs(hash(account.domain + ":r:" + i)) % ROLES.length;
    const fIdx = Math.abs(hash(account.domain + ":f:" + i)) % FIRST.length;
    const lIdx = Math.abs(hash(account.domain + ":l:" + i)) % LAST.length;
    const title = ROLES[idx];
    const firstName = FIRST[fIdx];
    const lastName = LAST[lIdx];
    const lt = title.toLowerCase();
    let seniority = "manager";
    if (/founder|co[- ]?founder/.test(lt)) seniority = "founder";
    else if (/ceo|chief|coo|cto|cmo|cpo|cgo|cro|cfo/.test(lt)) seniority = "c_suite";
    else if (lt.includes("vp") || lt.includes("head")) seniority = "head";
    const linkedinUrl = `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${i}`;
    const fullName = `${firstName} ${lastName}`;
    out.push({
      firstName, lastName, fullName,
      title, linkedinUrl,
      seniority,
      pickedReason: `Decision-maker title match for ${account.industry} segment.`,
      personKey: makePersonKey({ linkedinUrl, fullName, firstName, lastName }),
    });
  }
  return out;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export async function stakeholderAgent(input: StakeholderInput): Promise<{ output: StakeholderOutput; state: Pick<PhaseState, "log" | "metrics" | "inputCount" | "outputCount"> }> {
  const apiKey = (process.env.APOLLO_API_KEY || "").trim();
  const live = !!apiKey;
  const log: string[] = [];
  log.push(live ? "Apollo live: people search enabled (no credit cost)." : "Apollo mock: deterministic stakeholder pick.");

  const searchTitles = mergeDecisionMakerTitles(input.championTitles);
  const requested = input.concurrency || Math.min(Math.max(input.topAccounts.length, 1), 10);
  const concurrency = Math.max(1, Math.min(15, Math.min(requested, input.topAccounts.length || 1)));
  log.push(`Searching with ${searchTitles.length} titles (decision-maker priority: founder, co-founder, CEO, chief-level). Up to ${LEADS_PER_ACCOUNT} leads per account · concurrency ${concurrency}.`);

  const rows: StakeholderRow[] = [];
  let found = 0, missed = 0;
  let accountsWithAny = 0;
  let processed = 0;
  let cancelled = false;
  const startedAt = Date.now();
  let rowSeq = 0;
  const persistMutex: { p: Promise<void> } = { p: Promise.resolve() };

  async function persistOrdered(row: StakeholderRow): Promise<void> {
    rowSeq++;
    const idx = rowSeq - 1;
    rows.push(row);
    if (!input.onAccount) return;
    const next = persistMutex.p.then(async () => {
      try { await input.onAccount!(row, idx); } catch (err) {
        log.push(`Persist callback failed for ${row.account.domain}: ${err instanceof Error ? err.message : "unknown"}`);
      }
    });
    persistMutex.p = next;
    return next;
  }

  async function processAccount(acc: ScoredAccount, accIdx: number): Promise<void> {
    if (cancelled) return;
    if (input.signal?.aborted) { cancelled = true; return; }
    if (input.shouldCancel && await input.shouldCancel()) { cancelled = true; return; }

    const accountStakeholders: Stakeholder[] = [];
    if (live) {
      try {
        let people = await searchPeopleApollo(acc.domain, searchTitles, apiKey, input.signal);
        // Strict-match: only keep people whose organization.primary_domain matches acc.domain
        // exactly. Apollo's q_organization_domains_list can leak adjacent orgs (libas.in
        // bringing back leads from libaas.in / libasify.com). Same defect we fixed for
        // CoreSignal, now applied to Apollo too.
        const filtered = filterPeopleByDomain(people, acc.domain);
        if (filtered.rejected.length > 0) {
          const reasonCounts = new Map<string, number>();
          for (const r of filtered.rejected) reasonCounts.set(r.reason, (reasonCounts.get(r.reason) || 0) + 1);
          const reasonSummary = Array.from(reasonCounts.entries()).map(([k, v]) => `${k}=${v}`).join(", ");
          const samples = filtered.rejected.slice(0, 5).map((r) => `${r.person.name || "?"}@${r.orgDomain || "(no org)"}`).join(", ");
          log.push(`Strict-match reject for ${acc.domain}: dropped ${filtered.rejected.length}/${people.length} person(s). Reasons: ${reasonSummary}. Samples: ${samples}.`);
        }
        people = filtered.kept;
        // If Apollo's domain index doesn't have this org (common for sub-brands like
        // bikewale.com, libas.in), retry by company-name keyword — BUT ONLY when we have
        // a real, Apollo-verified company name. When acc.name is empty, that means this is
        // an operator-typed stub (no Apollo data at all), and running a fuzzy name-search
        // with a domain-derived name would pull leads from adjacent companies. Strict-stick
        // means: no name = no fuzzy expansion = honest zero leads.
        if (people.length === 0 && acc.name) {
          try {
            const byName = await searchPeopleByCompanyName(acc.name, searchTitles, apiKey, input.signal);
            if (byName.length > 0) {
              const filteredByName = filterPeopleByDomain(byName, acc.domain);
              if (filteredByName.kept.length > 0) {
                log.push(`Domain miss for ${acc.domain} — recovered ${filteredByName.kept.length}/${byName.length} via name="${acc.name}" (rejected ${filteredByName.rejected.length} adjacent orgs).`);
                people = filteredByName.kept;
              } else {
                const sampleRejects = filteredByName.rejected.slice(0, 5).map((r) => `${r.person.name || "?"}@${r.orgDomain || "(no org)"}`).join(", ");
                log.push(`Name search "${acc.name}" returned ${byName.length} candidate(s) but ALL rejected — none had primary_domain=${acc.domain}. Samples: ${sampleRejects}.`);
              }
            }
          } catch (err) {
            log.push(`Name-search fallback failed for ${acc.domain}: ${err instanceof Error ? err.message : "unknown"}`);
          }
        } else if (people.length === 0 && !acc.name) {
          log.push(`Strict-stick: ${acc.domain} not in Apollo's domain index AND no verified company name available → skipping fuzzy name-search to prevent adjacent-org contamination. Honest result: 0 leads for this account.`);
        }
        const picks = pickTopN(people, LEADS_PER_ACCOUNT);
        for (const pick of picks) {
          const p = pick.person;
          const fn = p.first_name || (p.name || "").split(" ")[0] || "";
          const ln = p.last_name || (p.name || "").split(" ").slice(1).join(" ") || "";
          const linkedinUrl = p.linkedin_url || "";
          const fullName = `${fn} ${ln}`.trim();
          const personKey = makePersonKey({ linkedinUrl, fullName, firstName: fn, lastName: ln });
          if (!personKey) continue;
          accountStakeholders.push({
            firstName: fn, lastName: ln, fullName,
            title: p.title || "",
            linkedinUrl,
            seniority: p.seniority || "",
            pickedReason: `Picked ${pick.tier} (decision maker) from ${people.length} candidates.`,
            personKey,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "unknown";
        if (input.signal?.aborted || /aborted|TimeoutError/i.test(msg)) {
          cancelled = true;
          return;
        }
        log.push(`Search failed for ${acc.domain}: ${msg}`);
      }
    } else {
      accountStakeholders.push(...mockPickMany(acc, LEADS_PER_ACCOUNT));
    }

    if (accountStakeholders.length === 0) {
      missed++;
      await persistOrdered({ account: acc, stakeholder: null });
    } else {
      accountsWithAny++;
      for (const s of accountStakeholders) {
        found++;
        await persistOrdered({ account: acc, stakeholder: s });
      }
    }

    processed++;
    if (processed % 50 === 0 || processed === input.topAccounts.length) {
      const elapsed = (Date.now() - startedAt) / 1000;
      const rate = processed / Math.max(elapsed, 1);
      const remaining = input.topAccounts.length - processed;
      const eta = Math.round(remaining / Math.max(rate, 0.001));
      log.push(`Progress: ${processed}/${input.topAccounts.length} accounts (${found} stakeholders) · ${rate.toFixed(1)}/s · ETA ${eta}s · acc#${accIdx + 1}`);
    }
  }

  const queue = input.topAccounts.map((acc, i) => ({ acc, i }));
  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      if (cancelled) return;
      const item = cursor < queue.length ? queue[cursor++] : null;
      if (!item) return;
      await processAccount(item.acc, item.i);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await persistMutex.p;

  if (cancelled) {
    log.push(`Cancelled at ${processed}/${input.topAccounts.length} accounts.`);
  }

  log.push(`${found} stakeholders found across ${accountsWithAny}/${input.topAccounts.length} accounts. ${missed} accounts missed. Total time ${Math.round((Date.now() - startedAt) / 1000)}s.`);

  return {
    output: { rows, found, missed },
    state: {
      log,
      metrics: {
        found, missed, total: input.topAccounts.length,
        accountsWithAny,
        leadsPerAccount: LEADS_PER_ACCOUNT,
        hitRatePct: input.topAccounts.length === 0 ? 0 : Math.round((accountsWithAny / input.topAccounts.length) * 100),
      },
      inputCount: input.topAccounts.length,
      outputCount: found,
    },
  };
}
