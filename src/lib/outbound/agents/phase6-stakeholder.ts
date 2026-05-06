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

const SENIORITY_RANK: Record<string, number> = {
  "owner": 7, "founder": 7, "c_suite": 5, "vp": 4, "head": 4, "director": 3, "senior": 2, "manager": 1, "individual_contributor": 0,
};

function strongerTitle(t: string): number {
  const lt = t.toLowerCase();
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
        const people = await searchPeopleApollo(acc.domain, searchTitles, apiKey, input.signal);
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
